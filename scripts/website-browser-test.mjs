import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const base=process.env.BASE_URL || 'http://127.0.0.1:3100';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
await mkdir('ui-test-results',{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const result={passed:[],failed:[]};
async function test(name,fn){try{await fn();result.passed.push(name);console.log('PASS',name)}catch(e){result.failed.push({name,error:String(e)});console.error('FAIL',name,e)}}
const open=async(url='/')=>page.goto(base+url,{waitUntil:'domcontentloaded',timeout:30000});
await test('homepage and responsive photo cards render',async()=>{
  const response=await open();
  assert.equal(response?.status(),200);
  await page.getByRole('heading',{name:/Find local help/i}).waitFor();
  assert.equal(await page.locator('.ref-category-card').count(),8);
  assert.equal(await page.locator('.ref-task-card').count(),6);
  const images=page.locator('.ref-category-photo img');
  await images.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(2800);
  const stat=await images.evaluateAll(nodes=>nodes.map(n=>({src:n.currentSrc,complete:n.complete,width:n.naturalWidth,displayWidth:n.getBoundingClientRect().width})));
  console.log('Photo image audit',JSON.stringify(stat));
  assert.ok(stat.every(p=>p.width>=350),'Card photos must load at >= 350 intrinsic pixels');
  assert.ok(stat.every(p=>p.width>p.displayWidth),'Card imagery must never upscale past native width');
  assert.ok(!((await page.content()).includes('/images/mombasa-services-reference.webp')),'Tiny sprites cannot appear in active homepage');
  await page.screenshot({path:'ui-test-results/desktop.png',fullPage:true});
});
await test('navigation to every service detail page',async()=>{
 for(const slug of ['plumbing','electrical','cleaning','painting','carpentry','appliance-repair','general-repairs','other-services']){
   await open();
   await page.locator('.ref-category-card[href="/services/'+slug+'"]').click();
   await page.waitForURL('**/services/'+slug);
   assert.equal(new URL(page.url()).pathname,'/services/'+slug);
 }
});
await test('header location selector synchronizes search location',async()=>{
 await open();
 await page.getByRole('combobox',{name:'Choose your pilot neighbourhood'}).selectOption('Nyali');
 assert.equal(await page.getByRole('combobox',{name:'Your service area'}).inputValue(),'Nyali');
});
await test('search submits details and selected pilot location',async()=>{
 await open();
 await page.getByRole('combobox',{name:'Choose your pilot neighbourhood'}).selectOption('Nyali');
 await page.getByRole('textbox',{name:'Describe what you need help with'}).fill('My kitchen sink is leaking today');
 await page.locator('.ref-search button[type=submit]').click();
 await page.waitForURL('**/request?**');
 const params=new URL(page.url()).searchParams;
 assert.equal(params.get('category'),'plumbing');assert.equal(params.get('area'),'Nyali');
 assert.equal(params.get('description'),'My kitchen sink is leaking today');
});
await test('popular chips and carousel buttons really change route/cards',async()=>{
 await open();
 const original=await page.locator('.ref-task-card').first().innerText();
 await page.getByRole('button',{name:'Next service cards'}).click();
 const next=await page.locator('.ref-task-card').first().innerText();
 assert.notEqual(original,next);
 await page.getByRole('button',{name:'Previous service cards'}).click();
 assert.equal(await page.locator('.ref-task-card').first().innerText(),original);
 await page.locator('.ref-popular-chips').getByRole('button',{name:'Electrical'}).click();
 await page.waitForURL('**/request?**');
 assert.equal(new URL(page.url()).searchParams.get('category'),'electrical');
});
await test('provider CTA and two-step application work',async()=>{
 await open();
 await page.locator('header a.nav-button').click();
 await page.waitForURL('**/providers/apply');
 await page.getByRole('textbox',{name:'Full name'}).fill('JiTap Browser QA');
 await page.getByRole('textbox',{name:'Mobile number'}).fill('0712345678');
 await page.getByRole('button',{name:/Continue/}).click();
 await page.getByText('Step 2 of 2').waitFor();
 await page.getByRole('button',{name:/Back/}).click();
 await page.getByText('Step 1 of 2').waitFor();
});
await test('help link, category action and mobile menu',async()=>{
 await open();
 await page.locator('a.jh-help-widget').click();await page.waitForURL('**/contact');
 await page.setViewportSize({width:390,height:844});
 await open();
 const overflow=await page.evaluate(()=>({full:document.documentElement.scrollWidth,view:window.innerWidth}));
 assert.ok(overflow.full <= overflow.view+3,'Horizontal overflow on 390px viewport '+JSON.stringify(overflow));
 await page.screenshot({path:'ui-test-results/mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Open menu'}).click();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Find Services'}).click();
 await page.waitForURL('**/services');
});
await browser.close();
console.log('\nUI TEST RESULT',JSON.stringify(result));
if(result.failed.length)process.exit(1);
