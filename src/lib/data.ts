import {understandJob} from '@/lib/job-intelligence';
import {Droplets,Zap,Paintbrush,Hammer,Sparkles,Refrigerator,Wrench,Truck,MoreHorizontal,type LucideIcon} from 'lucide-react';
export type Category={slug:string;name:string;summary:string;description:string;jobs:string[];tips:string[];icon:LucideIcon};
export const categories:Category[]=[
{slug:'plumbing',name:'Plumbing',summary:'Leaks, taps, pipes and drainage',description:'Need a plumber in Mombasa? Describe a leak, blocked drain, tap repair or installation and JiTap can help capture your request for local coordination.',jobs:['Leaking taps and sinks','Blocked drains','Pipe inspections and repairs','Fittings and installations'],tips:['Turn off the relevant water supply if safe.','Describe where the water is coming from.','Share a photo only if comfortable.'],icon:Droplets},
{slug:'electrical',name:'Electrical',summary:'Sockets, wiring and electrical faults',description:'From faulty sockets to electrical inspections, tell JiTap what needs attention. Electrical work should be handled by suitably qualified people.',jobs:['Socket and switch faults','Lighting installation','Electrical inspection','Wiring repairs'],tips:['Do not touch exposed wires.','If there is smoke or fire, use emergency services.','Avoid hazardous electrical DIY work.'],icon:Zap},
{slug:'cleaning',name:'Cleaning',summary:'Mama Fua, home cleaning and laundry',description:'JiTap helps you explain cleaning needs as pilot service coverage grows.',jobs:['Mama Fua','House cleaning','Laundry','Hand washing','Ironing','Duvets','Home cleaning','Office cleaning','Move-in cleaning','Deep cleaning'],tips:['Describe approximate property size.','List priority areas and supplies needed.'],icon:Sparkles},
{slug:'painting',name:'Painting',summary:'Walls, interiors and finishing',description:'Specify rooms, surfaces, timing and location to get started.',jobs:['Interior painting','Exterior painting','Wall preparation','Touch-up jobs'],tips:['Estimate the size of the area.','Mention if paint is available.'],icon:Paintbrush},
{slug:'carpentry',name:'Carpentry',summary:'Furniture, doors and cabinetry',description:'Describe a furniture repair, cabinet or door-fitting task.',jobs:['Door repair','Cabinet fitting','Furniture assembly','Custom carpentry'],tips:['Provide dimensions if known.','Explain whether repair or fabrication is needed.'],icon:Hammer},
{slug:'appliance-repair',name:'Appliance Repair',summary:'Fridges, washers and home appliances',description:'Describe the appliance, fault and urgency.',jobs:['Fridge faults','Washing machine repair','Cooker servicing','Diagnosis'],tips:['Include brand and model if known.','Unplug visibly damaged equipment if safe.'],icon:Refrigerator},
{slug:'general-repairs',name:'General Repairs',summary:'Everyday fixes and maintenance',description:'Not sure which specialist? Explain the problem and JiTap can assess a suitable service category.',jobs:['Door handles','Small fixes','Fixture repairs','General maintenance'],tips:['Describe what stopped working.','Indicate timing and access constraints.'],icon:Wrench},
{slug:'moving',name:'Moving & Relocation',summary:'House moving and packing help',description:'Tell JiTap where you are moving, what you need transported and when. Compare indicative moving costs before requesting a local mover quote.',jobs:['House moving','Movers','Relocation','Shifting house','Moving delivery','Moving truck'],tips:['Share both locations and floor access.','Tell JiTap about special items before the move.'],icon:Truck},
{slug:'other-services',name:'Other Services',summary:'Tell us what you need',description:'JiTap is exploring additional services based on coverage and customer needs.',jobs:['Describe your job','Clarify location','Select preferred timing'],tips:['Be specific about the desired outcome.'],icon:MoreHorizontal}
];
export const areas=['Bamburi','Nyali','Mtwapa','Tudor','Changamwe','Likoni'];
export const journeys={customer:[['ASK','Describe what you need and where.'],['MATCH','JiTap assesses the service and supported pilot coverage.'],['BUZZ','A selected provider can respond; the request progresses when a connection is confirmed.']],provider:[['GET READY','Apply, share skills and select areas.'],['MATCH','Receive suitable opportunities when the supported pilot is active.'],['BUZZ','Respond and coordinate arrival and progress when assigned.']]};
export type Guide={slug:string;title:string;description:string;date:string;author:string;sections:{heading:string;paragraph:string}[];category:string};
export const guides:Guide[]=[
{slug:'choose-a-plumber-in-mombasa',title:'How to Choose a Plumber in Mombasa',description:'Useful questions before arranging a plumbing visit.',date:'2026-10-27',author:'JiTap Editorial',category:'Home maintenance',sections:[{heading:'Explain the problem first',paragraph:'Is the sink dripping, the pipe visibly broken or water overflowing? A clear description helps a professional assess an inspection or repair.'},{heading:'Discuss scope and fees',paragraph:'Ask about call-out fees, materials, quotations and the work included before it starts.'},{heading:'Think about safety',paragraph:'Shut off the relevant water supply if safe, and share only a general location in public messages.'}]},
{slug:'before-hiring-an-electrician',title:'What to Check Before Hiring an Electrician',description:'Understand safety and basic questions to ask.',date:'2026-10-27',author:'JiTap Editorial',category:'Home maintenance',sections:[{heading:'Safety comes first',paragraph:'Avoid exposed wires and damaged electrical equipment. Contact a suitably qualified professional.'},{heading:'Describe the fault',paragraph:'Explain whether the issue involves sockets, lighting, appliances or circuit protection.'},{heading:'Ask about qualifications and a clear quote',paragraph:'Discuss relevant qualifications, the expected inspection and quotation. Do not assume a profile guarantees certification.'}]},
{slug:'questions-to-ask-a-fundi',title:'Five Questions to Ask Before Hiring a Fundi',description:'Simple ways to clarify a local service request.',date:'2026-10-27',author:'JiTap Editorial',category:'Service tips',sections:[{heading:'What task is included?',paragraph:'Describe the desired result, existing condition and measures of success.'},{heading:'When can they come?',paragraph:'Agree on an estimated arrival window and updates.'},{heading:'What will it cost?',paragraph:'Clarify call-out charges, materials, quote validity and payments.'},{heading:'What area do they cover?',paragraph:'Nearby providers may still have travel limitations.'},{heading:'How is completion confirmed?',paragraph:'Agree what will be inspected before the job is marked complete.'}]}
];
export const serviceBySlug=(slug:string)=>categories.find(x=>x.slug===slug);
export const guideBySlug=(slug:string)=>guides.find(x=>x.slug===slug);
/**
 * Conservative local-service routing.
 * Match whole service terms and the requested action, never fragments of a
 * label (e.g. "handle" must NOT match "hand washing").
 * Unclear requests stay unclassified for contextual AI intake.
 */
export function inferService(query:string):string|undefined {
 const t=query.toLowerCase().replace(/\s+/g,' ').trim();
 if(!t)return undefined;
 const understood=understandJob(query);
 if(understood)return understood.category;
 // Explicit cleaning task wins over a coincidental moving or repair noun.
 if(/\b(?:mov(?:e|ing)[- ]out|post[- ]move|after moving)\s+clean(?:ing)?\b|\b(?:clean|wash|wipe|polish)\s+(?:my\s+|the\s+|a\s+)?(?:door|handle|furniture|floor|house|home)\b/.test(t))return 'cleaning';
 // Moving furniture is transport work, not furniture carpentry.
 if(/\b(?:mov(?:e|es|ing|ers)|relocat(?:e|ion|ing)|shifting|kuhama|nihame|transport(?:ing)?)\b/.test(t)&&
    /\b(?:house|home|furniture|wardrobe|sofa|bed|truck|delivery|relocation|moving|office|items|goods|kuhama|nihame)\b/.test(t))return 'moving';
 // Appliance names override mentions of a door, handle, motor or pipe.
 if(/\b(?:fridge|refrigerator|freezer|friji|washing machine|washer|dishwasher|cooker|oven|appliance repair)\b/.test(t))return 'appliance-repair';
 if(/\b(?:plumb(?:er|ing|ers)?|fundi wa maji|bomba|mabomba|tap|faucet|sink|drain|pipe|leak(?:ing|age)?|dripping|imeziba|imevuja|inavuja|choo imeziba)\b/.test(t))return 'plumbing';
 if(/\b(?:electrician|fundi wa stima|stima|electric(?:al)?|wiring|socket|soketi|switch|power fault|circuit breaker)\b/.test(t))return 'electrical';
 if(/\b(?:paint(?:er|ing)?|kupaka rangi|rangi ya nyumba)\b/.test(t))return 'painting';
 if(/\b(?:mama[ -]*fua|mamafua|kufua|laundry|laundering|housekeeper|house cleaner|house cleaning|clean my house|clean my home|cleaning|ironing|folding clothes|wash clothes|wash duvets?|wash blankets?|duvet washing)\b/.test(t))return 'cleaning';
 if(/\b(?:carpenter|carpentry|fundi wa mbao|kabati|wardrobe|furniture|cabinet|hinge|hinges|door|doors|door handle|door knob|door lock|mlango)\b/.test(t))return 'carpentry';
 if(/(?:\b(?:tv|television|smart tv|screen)\b.{0,55}\b(?:mount|mounting|install|hang|bracket|wall)\b|\b(?:mount|mounting|hang|bracket)\b.{0,55}\b(?:tv|television|screen)\b)/.test(t))return 'general-repairs';
 if(/\b(?:handyman|general repairs|fixture repair|wall mounting)\b/.test(t))return 'general-repairs';
 // Do not invent a service from partial substrings; ask for clarification.
 return undefined;
}
