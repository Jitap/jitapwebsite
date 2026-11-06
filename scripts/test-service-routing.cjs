const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');

function load(relative, mocks={}){
 const source=fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 const requireMock=(id)=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  throw new Error('Unrecognized dependency in routing test: '+id);
 };
 vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{})(requireMock,module,module.exports);
 return module.exports;
}
const intent=load('src/lib/job-intelligence.ts');
const lucide=new Proxy({},{get:()=>()=>null});
const {inferService}=load('src/lib/data.ts',{'@/lib/job-intelligence':intent,'lucide-react':lucide});
const checks=[
 ['I need to replace my door handle','carpentry'],
 ['My door handle is broken','carpentry'],
 ['Fix my door lock and hinges','carpentry'],
 ['Nahitaji fundi wa mbao','carpentry'],
 ['Repair my wardrobe','carpentry'],
 ['Fix the fridge door handle','appliance-repair'],
 ['Washing machine door will not close','appliance-repair'],
 ['My freezer is not cooling','appliance-repair'],
 ['Microwave does not heat','appliance-repair'],
 ['My tap handle is leaking','plumbing'],
 ['Kitchen sink leaking water','plumbing'],
 ['Need a plumber','plumbing'],
 ['Choo imeziba','plumbing'],
 ['A broken socket needs repair','electrical'],
 ['My ceiling fan is making noise','electrical'],
 ['Nahitaji fundi wa stima','electrical'],
 ['Paint my bedroom walls','painting'],
 ['Paint the wooden door','painting'],
 ['Mama Fua for my laundry','cleaning'],
 ['Wash clothes and blankets','cleaning'],
 ['Deep cleaning for my house','cleaning'],
 ['Clean my door handles','cleaning'],
 ['Moving out cleaning for the house','cleaning'],
 ['Move my furniture to a new house','moving'],
 ['Need a house moving truck','moving'],
 ['I am relocating my office','moving'],
 ['TV wall mounting','general-repairs'],
 ['Need a handyman for some fixtures','general-repairs'],
 ['Repair my laptop screen','other-services'],
 ['Need a mechanic for car repairs','other-services'],
 ['Need a tailor to alter clothes',undefined],
 ['I need someone to help with something',undefined]
];
let passed=0;
for(const [description,expected] of checks){
 const got=inferService(description);
 try{assert.equal(got,expected,description)}catch{throw new Error('Routing case failed: '+JSON.stringify({description,expected,got}))}
 passed++;
}
console.log('JiTap routing regression: '+passed+' cases passed.');
