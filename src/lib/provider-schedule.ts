/** Formats stored customer choices without substituting an inferred urgency or date. */
export function providerPreferredDate(raw:string|undefined|null){
 const value=raw?.trim()||'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return 'Not selected by customer';
 const date=new Date(value+'T12:00:00Z');
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)return 'Not selected by customer';
 return new Intl.DateTimeFormat('en-KE',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}
export function providerPreferredTime(raw:string|undefined|null){
 const value=raw?.trim()||'';
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return 'Not selected by customer';
 const [hours,minutes]=value.split(':').map(Number);
 return (hours%12||12)+':'+String(minutes).padStart(2,'0')+' '+(hours<12?'AM':'PM')+' EAT';
}
