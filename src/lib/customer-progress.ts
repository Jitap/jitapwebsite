/**
 * Canonical customer progress stages driven by the same request status that
 * powers the status badge. Never infer progress from human-readable labels.
 *
 * 0 Requested -> 1 Matched -> 2 En Route -> 3 In Progress -> 4 Completed
 *
 * "arrived" remains En Route until work is explicitly marked in progress.
 * Rematch/cancellation returns to Requested and does not show stale progress.
 */
export const customerProgressSteps=['Requested','Matched','En Route','In Progress','Completed'] as const;

const statuses:Record<string,number>={
 new:0,received:0,incomplete:0,needs_sourcing:0,matching:0,reviewing:0,
 provider_contacted:0,awaiting_quote:0,rematch_approval:0,rematching:0,
 cancelled:0,closed:0,archived:0,
 accepted:1,assigned:1,matched:1,confirmed:1,scheduled:1,booking_confirmed:1,
 on_my_way:2,en_route:2,arrived:2,provider_arrived:2,
 in_progress:3,work_started:3,working:3,
 completed:4,finished:4,done:4
};
export function customerProgressStage(status:string):number {
 const normalized=(status||'').toLowerCase().trim().replace(/[\s-]+/g,'_');
 return statuses[normalized]??0;
}
