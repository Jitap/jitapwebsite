import {z} from 'zod';
const phone=z.string().trim().transform(v=>v.replace(/[\s().-]/g,'')).pipe(z.string().regex(/^(?:\+254|254|0)(?:7|1)\d{8}$/,'Enter a valid Kenyan mobile, e.g. 0712345678 or +254712345678'));
const common={name:z.string().trim().min(2).max(120),phone,consent:z.literal(true),website:z.string().max(0).optional()};
export const requestSchema=z.object({...common,category:z.string().min(2).max(80),description:z.string().trim().min(12).max(1500),area:z.enum(['Bamburi','Nyali','Mtwapa','Tudor','Changamwe','Likoni']),timing:z.enum(['today','this-week','flexible'])});
export const providerSchema=z.object({...common,email:z.union([z.literal(''),z.string().email()]).optional(),category:z.string().min(2),skills:z.string().trim().min(10,'Describe your skills in at least 10 characters').max(1500),areas:z.array(z.enum(['Bamburi','Nyali','Mtwapa','Tudor','Changamwe','Likoni'])).min(1),experience:z.enum(['0-2','3-5','6-10','10+']),contactChannel:z.enum(['phone','whatsapp'])});
export const contactSchema=z.object({name:z.string().min(2).max(120),email:z.string().email(),type:z.enum(['service','provider','support','business','partnership','general']),message:z.string().min(10).max(2000),consent:z.literal(true),website:z.string().max(0).optional()});
export const earlySchema=z.object({email:z.string().email(),consent:z.literal(true),website:z.string().max(0).optional()});
export type FormKind='request'|'provider'|'contact'|'early-access';
export const schemas={request:requestSchema,provider:providerSchema,contact:contactSchema,'early-access':earlySchema};
