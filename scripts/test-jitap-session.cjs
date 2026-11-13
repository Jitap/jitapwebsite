const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const module = {exports: {}};
  const requireMock = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
    throw new Error('Unrecognized dependency: ' + id);
  };
  vm.runInNewContext('(function(require,module,exports){' + js + '\n})', {})(requireMock, module, module.exports);
  return module.exports;
}

function mockReq({headers = {}, cookies = {}} = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: {
      get(name) {
        return map.get(name.toLowerCase()) ?? null;
      },
    },
    cookies: {
      get(name) {
        const v = cookies[name];
        return v !== undefined ? {value: v} : undefined;
      },
    },
  };
}

const calls = [];
const goTrue = async (path, body, token, method) => {
  calls.push({path, body, token, method});
  if (path === 'user' && token === 'valid-bearer') {
    return {ok: true, data: {id: 'user-1', phone: '+254712345678'}};
  }
  if (path === 'user' && token === 'valid-access') {
    return {ok: true, data: {id: 'user-cookie', phone: '+254700000001'}};
  }
  if (path === 'user' && token === 'bad-bearer') {
    return {ok: false, data: {}};
  }
  if (path === 'token?grant_type=refresh_token') {
    return {ok: true, data: {access_token: 'valid-access', refresh_token: 'new-refresh', expires_in: 7200}};
  }
  return {ok: false, data: {}};
};

const {
  parseBearerAuthorization,
  actingAsCustomer,
  isMobileClient,
  resolveAccessSession,
} = load('src/lib/jitap-session.ts', {'@/lib/jitap-auth': {goTrue}});

assert.equal(parseBearerAuthorization(mockReq({headers: {authorization: 'Bearer abc.def'}})), 'abc.def');
assert.equal(parseBearerAuthorization(mockReq({headers: {authorization: 'bearer '}})), null);
assert.equal(parseBearerAuthorization(mockReq()), null);

assert.equal(actingAsCustomer(mockReq({cookies: {jt_mode: 'customer'}})), true);
assert.equal(actingAsCustomer(mockReq({headers: {'x-jitap-mode': 'customer'}})), true);
assert.equal(actingAsCustomer(mockReq()), false);

assert.equal(isMobileClient(mockReq({headers: {'x-jitap-client': 'mobile'}})), true);
assert.equal(isMobileClient(mockReq()), false);

(async () => {
  calls.length = 0;
  const bearerOnly = await resolveAccessSession(
    mockReq({headers: {authorization: 'Bearer valid-bearer'}}),
  );
  assert.equal(bearerOnly?.userId, 'user-1');
  assert.equal(bearerOnly?.fromCookies, false);

  calls.length = 0;
  const fallback = await resolveAccessSession(
    mockReq({
      headers: {authorization: 'Bearer bad-bearer'},
      cookies: {jt_access: 'valid-access', jt_refresh: 'stale-refresh'},
    }),
  );
  assert.equal(fallback?.userId, 'user-cookie');
  assert.equal(fallback?.fromCookies, true);

  calls.length = 0;
  const cookieOnly = await resolveAccessSession(
    mockReq({cookies: {jt_refresh: 'stale-refresh'}}),
  );
  assert.equal(cookieOnly?.accessToken, 'valid-access');
  assert.ok(cookieOnly?.rotated);

  const none = await resolveAccessSession(mockReq());
  assert.equal(none, null);

  console.log('jitap-session tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
