/** JiTap intent patterns: raw user words remain unchanged; this is a separate interpretation. */
export type JobQuestion={id:string;title:string;hint?:string;options:{value:string;label:string}[]};
export type JobIntent={category:string;subcategory:string;task:string;languagePattern:string;confidence:'high'|'medium';questions:JobQuestion[]};
const make=(id:string,title:string,labels:string[],hint?:string):JobQuestion=>({id,title,hint,options:labels.map(label=>({value:label,label}))});
export function understandJob(text:string):JobIntent|null {
 const t=text.trim().toLowerCase();
 if(!t)return null;
 const languagePattern=/\b(nataka|nahitaji|nipeeni|wapi|fundi wa|imekataa|huku|imevuja|inavuja)\b/.test(t)?'Kiswahili/Sheng with possible English loanwords':'English or mixed (unconfirmed)';
 const result=(category:string,subcategory:string,task:string,questions:JobQuestion[],confidence:'high'|'medium'='high'):JobIntent=>({category,subcategory,task,questions,confidence,languagePattern});
 if(/\b(fan|ceiling fan|standing fan|extractor fan|fundi wa fun)\b/.test(t))return result('electrical','fan-repair','Inspect or repair a fan',[
  make('fanType','Which fan needs help?',['Ceiling fan','Standing / pedestal fan','Wall fan','Extractor fan','Laptop / computer cooling fan','Not sure']),
  make('fanFault','What problem does the fan have?',['Not switching on','Slow or stopping','Making noise or shaking','Broken or damaged','Needs installation','Not sure'])
 ],t.includes('fundi wa fun')?'medium':'high');
 if(/\b(socket|soketi|power outlet)\b/.test(t))return result('electrical','socket-repair','Inspect and repair an electrical socket',[
  make('socketFault','What is happening with the socket?',['No power','Loose or damaged','Sparking or burning smell','Circuit breaker trips','Not sure'],'Do not touch exposed wiring or a sparking socket.'),
  make('socketCount','How many sockets are affected?',['One','Several','Whole room or house','Not sure'])
 ]);
 if(/\b(tv|television)\b/.test(t)&&/\b(repair|fix|fundi|broken|screen|fault)\b/.test(t)&&!/\b(mount|bracket|hang)\b/.test(t))
 return result('general-repairs','tv-repair','Diagnose a television fault',[
  make('tvFault','What is wrong with the TV?',['No picture','No power','Sound but no image','Broken screen','Other fault']),
  make('tvSize','What size is the screen?',['Up to 32 inches','33–43 inches','44–55 inches','56–65 inches','Over 65 inches','Not sure'])
 ]);
 if(/\b(microwave)\b/.test(t))return result('appliance-repair','microwave-repair','Diagnose a microwave fault',[
  make('microwaveFault','What is wrong with the microwave?',['Not heating','Not switching on','Door or turntable issue','Other / not sure'])
 ]);
 if(/\b(macbook|laptop|desktop|motherboard|projector|ps5|playstation|iphone|camera)\b/.test(t))return result('other-services','computer-electronics','Find electronics repairs or components',[
  make('deviceNeed','What help do you need for the device?',['Repair a fault','Diagnose a fault','Find a replacement part','Find a screen','Not sure']),
  make('deviceModel','Which device is it?',['Laptop / MacBook','Desktop / motherboard','Projector','Camera','Game console','Phone'])
 ]);
 if(/\b(exhaust|muffler)\b/.test(t))return result('other-services','vehicle-exhaust','Find or repair an exhaust',[
  make('vehicleType','Which vehicle is this for?',['Car','Motorcycle','Van or pickup','Not sure']),
  make('exhaustTask','What do you need?',['Buy an exhaust','Repair existing exhaust','Install or replace','Compare prices'])
 ]);
 if(/\b(photographer|photoshoot|photography)\b/.test(t))return result('other-services','photography','Photography assistance',[
  make('photoTask','What do you need help with?',['Book a photoshoot','Find a photographer','Follow up on previous photos','Other / not sure'])
 ]);
 return null;
}