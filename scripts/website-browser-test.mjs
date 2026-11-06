import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:3100';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
await mkdir('ui-test-results',{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const results={passed:[],failed:[]};
async function check(name,fn){try{await fn();console.log('PASS',name);results.passed.push(name)}catch(e){console.error('FAIL',name,e);results.failed.push({name,error:String(e)})}}
const open=(path='/')=>page.goto(base+path,{waitUntil:'domcontentloaded',timeout:30000});
await check('approved Google Drive photos load sharply and without repeats',async()=>{
 const res=await open();assert.equal(res?.status(),200);
 await page.getByRole('heading',{name:/Every job needs/i}).waitFor();
 assert.equal(await page.locator('.th-category').count(),4);
 assert.equal(await page.locator('.th-category-chip').count(),40);
 assert.equal(await page.locator('.th-category-all a').getAttribute('href'),'/services');
 assert.equal(await page.locator('.th-project').count(),6);
 await page.locator('.th-category').first().scrollIntoViewIfNeeded();
 await page.waitForTimeout(1700);
 const images=await page.locator('.th-categories img').evaluateAll(nodes=>nodes.map(n=>({src:n.getAttribute('src'),loaded:n.complete,natural:n.naturalWidth,display:Math.round(n.getBoundingClientRect().width)})));
 console.log('APPROVED IMAGES',JSON.stringify(images));
 assert.ok(images.every(x=>x.loaded&&x.natural>=450),'All category images must load from original approved photos');
 assert.equal(new Set(images.map(x=>x.src)).size,4,'No repeated category photographs');
 assert.ok(images.every(x=>x.natural>x.display),'No category image may be upscaled');
 const mascot=await page.locator('.th-hero-visual>img').evaluate(n=>({natural:n.naturalWidth,display:n.getBoundingClientRect().width}));
 assert.ok(mascot.natural>mascot.display,'Original mascot must never be upscaled');
 await page.screenshot({path:'ui-test-results/thumbtack-home-desktop.png',fullPage:true});
});
await check('all six Mombasa areas exist in homepage search and header',async()=>{
 await open();
 const options=await page.getByRole('combobox',{name:'Where do you need a fundi?'}).locator('option').allTextContents();
 assert.deepEqual(options,['Bamburi','Nyali','Mtwapa','Tudor','Changamwe','Likoni']);
 await page.getByRole('combobox',{name:'Where do you need a fundi?'}).selectOption('Tudor');
 assert.equal(await page.getByRole('combobox',{name:'Where do you need a fundi?'}).inputValue(),'Tudor');
});
await check('homepage service search sends a structured request',async()=>{
 await open();
 await page.getByRole('combobox',{name:'Where do you need a fundi?'}).selectOption('Mtwapa');
 await page.getByRole('textbox',{name:'Describe your project or problem'}).fill('My sink is leaking, I need a plumber.');
 await page.getByRole('button',{name:'Ask JiTap'}).click();
 await page.waitForURL('**/request?**');
 const params=new URL(page.url()).searchParams;
 assert.equal(params.get('area'),'Mtwapa');assert.equal(params.get('category'),'plumbing');
 assert.ok((params.get('description')||'').includes('sink is leaking'));
 await page.getByRole('heading',{name:/What plumbing issue/i}).waitFor();
});
await check('Thumbtack-style guided questions, progress, skip and contact step',async()=>{
 await open('/request?category=cleaning&area=Nyali&description=I%20need%20a%20house%20cleaner');
 await page.getByRole('heading',{name:/How often would you like/i}).waitFor();
 await page.getByRole('button',{name:'Every week'}).click();
 await page.getByRole('button',{name:/Next/}).click();
 await page.getByRole('heading',{name:/How big is the place/i}).waitFor();
 await page.getByRole('button',{name:'2 bedrooms'}).click();
 await page.getByRole('button',{name:/Next/}).click();
 await page.getByRole('button',{name:'Deep cleaning'}).click();
 await page.getByRole('button',{name:/Next/}).click();
 await page.getByRole('button',{name:/Within the week/i}).click();
 await page.getByRole('button',{name:/Continue to contact details/}).click();
 await page.getByRole('heading',{name:/How can JiTap reach you/i}).waitFor();
 await page.getByRole('textbox',{name:'Your name'}).waitFor();
 assert.equal(await page.getByRole('combobox',{name:'Neighbourhood',exact:true}).inputValue(),'Nyali');
 assert.equal(await page.getByRole('combobox',{name:'Preferred timing'}).inputValue(),'this-week');
 await page.screenshot({path:'ui-test-results/thumbtack-guided-request.png',fullPage:true});
});
await check('every category card links to a real service page',async()=>{
 for(const slug of ['plumbing','electrical','cleaning','moving']){
  await open();
  await page.locator('.th-category[href="/services/'+slug+'"]').click();
  await page.waitForURL('**/services/'+slug);
 }
});
await check('sticky search preserves typed problem and area when scrolling',async()=>{
 await page.setViewportSize({width:390,height:844});
 await open();
 await page.getByRole('textbox',{name:'Describe your project or problem'}).fill('My sink is leaking');
 await page.getByRole('combobox',{name:'Where do you need a fundi?'}).selectOption('Nyali');
 await page.evaluate(()=>window.scrollTo(0,1250));
 await page.locator('.th-sticky-search-visible').waitFor();
 assert.equal(await page.getByRole('textbox',{name:'Describe your service need'}).inputValue(),'My sink is leaking');
 assert.equal(await page.getByRole('combobox',{name:'Your service area'}).inputValue(),'Nyali');
 await page.screenshot({path:'ui-test-results/jitap-sticky-mobile.png'});
 await page.locator('.th-sticky-search-visible button[type="submit"]').click();
 await page.waitForURL('**/request?**');
 const params=new URL(page.url()).searchParams;
 assert.equal(params.get('area'),'Nyali');
 assert.equal(params.get('category'),'plumbing');
});
await check('all service icon shortcuts have valid links',async()=>{
 await open();
 assert.equal(await page.locator('.th-category-track-group:first-child a').count(),20);
 assert.ok((await page.locator('.th-category-track-group:first-child a').evaluateAll(links=>links.every(l=>l.getAttribute('href')?.startsWith('/services/')))));
 assert.equal(await page.getByRole('heading',{name:'Why customers love JiTap'}).count(),1);
 assert.equal(await page.locator('.jt-voice-card').count(),4);
 assert.ok((await page.locator('.jt-voice-card').first().innerText()).includes('From “Nani anajua fundi?” to just a tap.'));
 assert.equal(await page.locator('.jt-voice-avatar').count(),4);
 assert.equal(await page.locator('.jt-voice-stars').count(),4);
 assert.ok(await page.locator('.jt-voice-stars').first().getAttribute('aria-hidden')==='true');
 assert.ok((await page.locator('.jt-voices-stack').innerText()).includes('Know where your fundi is coming from.'));
 assert.equal(await page.locator('.jt-voice-card [aria-label="customer review"]').count(),0);
});
await check('four-stage JiTap carousel, animated timeline and manual step navigation',async()=>{
 await page.setViewportSize({width:390,height:844});
 await open();
 await page.getByRole('heading',{name:'How JiTap Works'}).waitFor();
 assert.equal(await page.locator('.jt-how-node').count(),4);
 assert.equal(await page.locator('.jt-how-slide').count(),4);
 assert.equal(await page.locator('.jt-how-artwork-frame').count(),4);
 for(const name of ['Green Checklist App on Smartphone.png','Three Cheerful Cartoon Tradespeople.png','Green Calendar and Clock Reminder.png','Completed Home Service Icon.png']){
  const imageResponse=await page.request.get(base+'/images/how-it-works/'+encodeURIComponent(name));
  assert.equal(imageResponse.status(),200,'Uploaded JiTap image must load: '+name);
 }
 const imageSources=await page.locator('.jt-how-uploaded-art').evaluateAll(images=>images.map(img=>decodeURIComponent(img.getAttribute('src')||'')));
 assert.equal(imageSources.length,4);
 assert.ok(imageSources.every(src=>!src.endsWith('/ask.png')&&!src.endsWith('/match.png')&&!src.endsWith('/buzz.png')&&!src.endsWith('/done.png')));
 assert.equal(await page.locator('.jt-how-progress-pulse').count(),0);
 assert.equal(await page.locator('.jt-how-node-caption').nth(2).innerText(),'BUZZ');
 assert.ok((await page.locator('.jt-how-artwork-frame').first().locator('img').count())===1 || (await page.locator('.jt-how-artwork-frame').first().locator('.jt-how-original-art').count())===1);
 const art=await page.request.get(base+'/images/how-it-works/original-illustrations.svg');
 assert.equal(art.status(),200,'Original artwork sprite must load');
 assert.ok((await art.text()).includes('data:image/webp;base64,'),'Original infographic artwork must be embedded');
 await page.getByRole('button',{name:'Show step 3: Connect and agree on a time'}).click();
 assert.ok((await page.locator('.jt-how-progress-fill').getAttribute('style')).includes('66.666'));
 assert.equal(await page.getByRole('heading',{name:'Connect and agree on a time'}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Play carousel'}).count(),1);
 await page.getByRole('button',{name:'Next step'}).click();
 assert.equal(await page.locator('.jt-how-slide[aria-hidden="false"] h3').innerText(),'Complete the job');
 await page.screenshot({path:'ui-test-results/jitap-how-works-mobile.png'});
});
await check('fundi directory contains 36 profiles but exposes no phone contacts',async()=>{
 const resp=await open('/fundis');assert.equal(resp?.status(),200);
 assert.equal(await page.locator('.td-pro-card').count(),36);
 const text=await page.locator('.td-pro-list').innerText();
 assert.ok(!/(?:\+?254|0)[ -]?[17]\d(?:[ -]?\d){7,8}/.test(text),'No Kenyan contact number may be visible');
 assert.ok(!/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(text),'No public email may be visible');
 assert.equal(await page.locator('.td-pro-card a[href*="/request"]').count(),36);
 await page.getByRole('combobox',{name:'Your area'}).selectOption('Changamwe');
 await page.getByText(/No submitted fundi profiles match/i).waitFor();
 await page.getByRole('combobox',{name:'Your area'}).selectOption('Nyali');
 assert.ok((await page.locator('.td-pro-card').count())>0);
 await page.screenshot({path:'ui-test-results/thumbtack-fundi-directory.png',fullPage:true});
});
await check('provider background loads and unsigned SMS hooks cannot dispatch',async()=>{
 const asset=await page.request.get(base+'/images/provider-signup.webp.png');
 assert.equal(asset.status(),200,'Provider signup asset must be accessible');
 const unsigned=await page.request.post(base+'/api/auth/hooks/send-sms',{data:{user:{phone:'+254700000000'},sms:{otp:'123456'}}});
 assert.ok([401,503].includes(unsigned.status()),'Hook must reject unsigned SMS requests');
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/login');
 assert.equal(await page.locator('.jt-auth-promo').count(),0);
 assert.equal(await page.locator('.jt-auth-panel').count(),1);
 assert.equal(await page.locator('.jt-auth-help').count(),0);
 await page.getByRole('button',{name:/I need services/}).click();
 assert.equal(await page.locator('.jt-auth-promo').count(),0);
 assert.equal(await page.locator('footer .brand img').count(),1);
 assert.equal(await page.locator('footer .brand img').getAttribute('src'),'/images/jitap-logo-white.svg');
 assert.equal(await page.locator('header .brand img').getAttribute('src'),'/images/jitap-logo.svg');
 const logo=await page.request.get(base+'/images/jitap-logo-white.svg');
 assert.equal(logo.status(),200);
 const svg=await logo.text();
 assert.ok(!svg.includes('<rect width="1002" height="455" fill="#ffffff"'),'Footer logo must not contain a white background rectangle');
 assert.ok(svg.includes('fill="#ffffff"'),'Footer logo paths must be white');
});
await check('signup/login navigation, role selection and invalid phone validation',async()=>{
 await page.setViewportSize({width:390,height:844});
 await open();
 await page.getByRole('button',{name:'Open menu'}).click();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Sign Up/Login'}).click();
 await page.waitForURL('**/login');
 await page.getByRole('heading',{name:'Join JiTap',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/I provide services/}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:/I need services/}).click();
 assert.equal(await page.getByRole('button',{name:/I need services/}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Log in'}).click();
 await page.getByRole('heading',{name:'Log in to JiTap'}).waitFor();
 const invalid=await page.request.post(base+'/api/auth/phone',{data:{action:'send',role:'customer',phone:'123'}});
 assert.equal(invalid.status(),422);
 await page.screenshot({path:'ui-test-results/jitap-signup-mobile.png'});
});
await check('guest request flow and private customer history remain separated',async()=>{
 const history=await page.request.get(base+'/api/account/requests');
 assert.equal(history.status(),401,'Guest must not access private request history');
 const payload=await history.json();
 assert.ok(!payload.requests,'Guest must not receive request details');
 await open('/account');
 await page.waitForURL('**/login?mode=login');
 await open('/request?category=plumbing&area=Bamburi&description=My%20sink%20is%20leaking');
 assert.equal(await page.locator('.jt-verified-contact').count(),0,'Guest should not be presented as verified');
});
await check('signed-in header shows My Account and guest request retains contact fields',async()=>{
 await page.route('**/api/auth/session',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,accountType:'customer',phone:'+254700000001',fullName:'JiTap QA Customer'})});
 });
 await open('/account');
 await page.getByRole('link',{name:'My Account'}).first().waitFor();
 assert.equal(await page.locator('.nav-button').innerText(),'My Account');
 await page.unroute('**/api/auth/session');
 await open('/request?category=plumbing&area=Bamburi&description=My%20sink%20is%20leaking');
 assert.equal(await page.locator('.jt-verified-contact').count(),0,'Guest cannot be shown as a verified customer');
});
await check('provider onboarding renders Kenya areas and no wallet or payments',async()=>{
 const unauth=await page.request.get(base+'/api/provider/workspace');
 assert.equal(unauth.status(),401,'Private provider endpoint must reject guest access');
 const review=await page.request.get(base+'/api/coordinator/provider-reviews');
 assert.equal(review.status(),401,'Staff review endpoint must reject guest access');
 await page.route('**/api/provider/workspace',async route=>{
  if(route.request().method()==='GET'){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({profile:null,reviewStatus:'not_submitted',opportunities:[],recentResponses:[]})});
  }else await route.continue();
 });
 await page.setViewportSize({width:390,height:844});
 await open('/provider');
 await page.getByRole('heading',{name:'Build your provider profile'}).waitFor();
 assert.equal(await page.getByText('Bamburi',{exact:true}).count()>0,true);
 assert.equal(await page.getByText('Nyali',{exact:true}).count()>0,true);
 assert.equal(await page.getByText('Addis Ababa').count(),0);
 assert.equal(await page.getByText('Wallet',{exact:true}).count(),0);
 await page.screenshot({path:'ui-test-results/jitap-provider-onboarding.png',fullPage:true});
 await page.unroute('**/api/provider/workspace');
});
await check('provider application supports six areas and back/continue',async()=>{
 await open();
 await page.goto(base+'/providers/apply');
 await page.waitForURL('**/providers/apply');
 await page.getByRole('textbox',{name:'Full name'}).fill('JiTap Browser QA');
 await page.getByRole('textbox',{name:'Mobile number'}).fill('0712345678');
 await page.getByRole('button',{name:/Continue/}).click();
 await page.getByText('Step 2 of 2').waitFor();
 for(const area of ['Bamburi','Nyali','Mtwapa','Tudor','Changamwe','Likoni'])assert.ok(await page.getByLabel(area,{exact:true}).count()>0);
 await page.getByRole('button',{name:'Back'}).click();
 await page.getByText('Step 1 of 2').waitFor();
});
await check('mobile menu, desktop Explore services and area list are interactive',async()=>{
 await open();
 await page.locator('.jt-explore summary').click();
 await page.locator('.jt-explore-panel a[href="/fundis"]').waitFor();
 await page.setViewportSize({width:390,height:844});
 await open();
 await page.getByRole('button',{name:'Open menu'}).click();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Find Fundis'}).click();
 await page.waitForURL('**/fundis');
 await page.screenshot({path:'ui-test-results/thumbtack-mobile-fundis.png',fullPage:true});
});
await check('request API validates newly supported area without requiring deployment DB',async()=>{
 for(const area of ['Bamburi','Nyali','Mtwapa','Tudor','Changamwe','Likoni']){
  const response=await page.request.post(base+'/api/intake/request',{headers:{'Content-Type':'application/json'},data:{name:'JiTap Test',phone:'123',consent:true,website:'',category:'cleaning',description:'Synthetic browser validation only',area,timing:'flexible'}});
  assert.equal(response.status(),422);
  const body=await response.json();
  assert.ok(body.issues?.phone?.length);
  assert.ok(!body.issues?.area,'Valid area should not be rejected: '+area);
 }
});
await check('eight viewport widths have no horizontal overflow',async()=>{
 for(const width of [320,360,375,390,414,768,1024,1440]){
  await page.setViewportSize({width,height:880});
  await open();
  const dims=await page.evaluate(()=>({viewport:window.innerWidth,doc:document.documentElement.scrollWidth}));
  assert.ok(dims.doc<=dims.viewport+3,'horizontal overflow width='+width+': '+JSON.stringify(dims));
  if([320,390,768].includes(width))await page.screenshot({path:'ui-test-results/thumbtack-width-'+width+'.png',fullPage:true});
 }
});
await browser.close();
console.log('FINAL CHECKS',JSON.stringify(results));
if(results.failed.length)process.exit(1);
