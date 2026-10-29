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
 assert.equal(await page.locator('.th-category').count(),8);
 assert.equal(await page.locator('.th-project').count(),6);
 await page.locator('.th-category').first().scrollIntoViewIfNeeded();
 await page.waitForTimeout(1700);
 const images=await page.locator('.th-categories img').evaluateAll(nodes=>nodes.map(n=>({src:n.getAttribute('src'),loaded:n.complete,natural:n.naturalWidth,display:Math.round(n.getBoundingClientRect().width)})));
 console.log('APPROVED IMAGES',JSON.stringify(images));
 assert.ok(images.every(x=>x.loaded&&x.natural>=450),'All category images must load from original approved photos');
 assert.equal(new Set(images.map(x=>x.src)).size,8,'No repeated category photographs');
 assert.ok(images.every(x=>x.natural>x.display),'No category image may be upscaled');
 const mascot=await page.locator('.th-hero-visual>img').evaluate(n=>({natural:n.naturalWidth,display:n.getBoundingClientRect().width}));
 assert.ok(mascot.natural>mascot.display,'Original mascot must never be upscaled');
 await page.screenshot({path:'ui-test-results/thumbtack-home-desktop.png',fullPage:true});
});
await check('all six Mombasa areas exist in homepage search and header',async()=>{
 await open();
 const options=await page.getByRole('combobox',{name:'Where do you need a fundi?'}).locator('option').allTextContents();
 assert.deepEqual(options,['Bamburi','Nyali','Mtwapa','Tudor','Changamwe','Likoni']);
 await page.getByRole('combobox',{name:'Choose your pilot neighbourhood'}).selectOption('Tudor');
 assert.equal(await page.getByRole('combobox',{name:'Where do you need a fundi?'}).inputValue(),'Tudor');
});
await check('homepage service search sends a structured request',async()=>{
 await open();
 await page.getByRole('combobox',{name:'Where do you need a fundi?'}).selectOption('Mtwapa');
 await page.getByRole('textbox',{name:'Describe your project or problem'}).fill('My sink is leaking, I need a plumber.');
 await page.getByRole('button',{name:'Find a fundi'}).click();
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
 for(const slug of ['plumbing','electrical','cleaning','painting','carpentry','appliance-repair','general-repairs','other-services']){
  await open();
  await page.locator('.th-category[href="/services/'+slug+'"]').click();
  await page.waitForURL('**/services/'+slug);
 }
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
await check('provider application supports six areas and back/continue',async()=>{
 await open();
 await page.locator('header a.nav-button').click();
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
