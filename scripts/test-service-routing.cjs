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
 ['Repair my laptop screen','it-repairs'],
 ['Need a mechanic for car repairs','vehicle-repair'],
 ['My roof is leaking and needs a roofer','roofing'],
 ['Replace rusted mabati on my roof','roofing'],
 ['Repair the damaged gutter','roofing'],
 ['Need a mason to plaster the walls','masonry'],
 ['Bricklaying and concrete foundation','masonry'],
 ['Tile my kitchen floor','tiling'],
 ['Repair cracked floor tiles','tiling'],
 ['Need a welder for my gate','welding'],
 ['Fabricate a steel railing','welding'],
 ['Install solar panels and inverter','solar-security'],
 ['CCTV camera installation','solar-security'],
 ['Repair the air conditioner','air-conditioning'],
 ['Need an AC refrigeration technician','air-conditioning'],
 ['Install new glass window panes','glass-aluminium'],
 ['Aluminium door repair','glass-aluminium'],
 ['Need pest control for termites','pest-control'],
 ['Landscaping and hedge trimming','landscaping'],
 ['Fix my printer','it-repairs'],
 ['Repair motorcycle brakes','vehicle-repair'],
 ['Need a tailor to alter clothes',undefined],
 ['I need someone to help with something',undefined]
];
let passed=0;
for(const [description,expected] of checks){
 const got=inferService(description);
 try{assert.equal(got,expected,description)}catch{throw new Error('Routing case failed: '+JSON.stringify({description,expected,got}))}
 passed++;
}
const {providerMatchesTrade}=load('src/lib/trade-categories.ts');
const {fundiListings}=load('src/lib/fundis-public.ts');
for(const id of ['fund-002','fund-004','fund-006','fund-019']){
 assert.equal(fundiListings.some(p=>p.id===id),false,'Excluded business still public: '+id);
}
for(const [slug,cats,expected] of [
 ['roofing',['Roofing'],true],
 ['roofing',['Cleaning'],false],
 ['roofing',['Plumbing'],false],
 ['welding',['Welding / Metalwork'],true],
 ['welding',['IT / Phone / Computer Services'],false],
 ['it-repairs',['IT / Phone / Computer Services'],true],
 ['it-repairs',['Computer & Phone Repair'],true],
 ['solar-security',['Solar, CCTV & Security'],true],
 ['masonry',['Masonry / Construction'],true],
 ['air-conditioning',['AC & Refrigeration'],true],
 ['moving',['Moving / Delivery'],true],
 ['other-services',['Other'],false]
]){
 assert.equal(providerMatchesTrade(slug,cats),expected,'Provider trade match failed: '+slug+' / '+cats);
 passed++;
}
console.log('JiTap routing regression: '+passed+' checks passed.');
