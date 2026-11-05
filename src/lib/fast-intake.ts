/**
 * High-confidence, local intake shortcuts.
 * Only return a template when the request clearly matches the job; unfamiliar
 * jobs still go to the AI service. All questions remain editable intake choices.
 * Do not include client contact/location or personal information in templates.
 */
export type FastIntakeQuestion={
 id:string;title:string;hint?:string;
 options:{value:string;label:string;hint?:string}[];
};
const question=(id:string,title:string,options:string[],hint?:string):FastIntakeQuestion=>({
 id,title,hint,options:options.map(label=>({value:label,label}))
});
export function fastIntakeQuestions(category:string,description:string):FastIntakeQuestion[]|null {
 const text=description.toLowerCase().trim().replace(/\s+/g,' ');
 if(text.length<8||text.length>180)return null;
 if(category==='plumbing'){
  const leaks=/\b(leak|leaking|drip|dripping|inavuja|imevuja|kuvuja|vuja)\b/.test(text);
  const blocked=/\b(block|blocked|clog|clogged|imeziba|ziba|drainage)\b/.test(text);
  if(leaks&&!blocked)return [
   question('leakLocation','Where is the water leaking?',['Tap or mixer','Under the sink','Pipe or joint','Toilet or shower','Not sure']),
   question('leakSeverity','How serious is the leak?',['Occasional drip','Constant trickle','Water flowing or pooling','Water supply turned off','Not sure'])
  ];
  if(blocked&&!leaks)return [
   question('blockedFixture','What is blocked?',['Kitchen sink','Bathroom sink','Toilet','Shower or floor drain','Outdoor drain','Not sure']),
   question('blockedSeverity','What happens when water drains?',['Drains slowly','Does not drain','Backs up or overflows','Not sure'])
  ];
  // A broad plumber request is still clearly plumbing, but the problem is unknown.
  if(/^(?:i\s+)?(?:need|want|looking for|find|require)\s+(?:a\s+)?(?:plumber|plumbing\s+fundi)(?:\s+(?:please|in\s+[\p{L}\s]+))?\.?$/iu.test(text)||/^(?:natafuta|nahitaji)\s+(?:fundi\s+wa\s+)?(?:plumbing|plamba)(?:\s+[\p{L}\s]+)?$/iu.test(text)){
   return [question('plumbingNeed','What do you need the plumber to help with?',['Leaking tap or pipe','Blocked drain or toilet','Toilet or shower repair','Install plumbing fittings','Other plumbing issue'])];
  }
 }
 if(category==='appliance-repair'){
  if(/\b(fridge|refrigerator|freezer|friji)\b/.test(text))return [
   question('fridgeFault','What is wrong with the fridge or freezer?',['Not cooling','Leaking water','Unusual noise','Not switching on','Door or seal problem','Other fault']),
   question('fridgeType','Which appliance needs repair?',['Fridge','Freezer','Fridge-freezer','Not sure'])
  ];
  if(/\b(washing machine|washer)\b/.test(text))return [
   question('washerFault','What problem does the washing machine have?',['Not starting','Not draining','Not spinning','Leaking','Unusual noise','Other problem'])
  ];
 }
 if(category==='painting'&&/\b(paint|painting|painter|kupaka rangi)\b/.test(text)){
  return [
   question('paintArea','What would you like painted?',['One room or wall','Several interior rooms','Exterior walls','Doors or fittings','Whole house']),
   question('paintPreparation','What condition is the surface in?',['Ready to paint','Needs filling or repairs','Old paint peeling','Not sure'])
  ];
 }
 if(category==='electrical'){
  if(/\b(light|lights|lighting|bulb|bulbs)\b/.test(text))return [
   question('lightJob','What help do you need with the lights?',['Install new lights','Repair a faulty light','Replace fittings','Lights keep flickering','Other lighting issue'])
  ];
 }
 if(category==='carpentry'){
  if(/\b(door|doors|mlango)\b/.test(text))return [
   question('doorJob','What needs doing to the door?',['Fix hinges or alignment','Repair lock or handle','Install or replace door','Repair damaged wood','Other door problem'])
  ];
 }
 return null;
}
