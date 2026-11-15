-- Each provider can receive a one-time 59-second offer per customer request / rematch round.
-- Expiry is enforced on SELECT and on accept/decline, never by changing customer request status.
CREATE OR REPLACE FUNCTION public.jitap_provider_available_buzz()
 RETURNS TABLE(request_id uuid, category text, area text, preferred_date text, preferred_time text, created_at timestamp with time zone, technical_summary text, proposed_scope text, urgency text, brief_source text, requested_timing text, job_location text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.jitap_provider_workspaces%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into p from public.jitap_provider_workspaces where user_id=auth.uid() and is_online=true and submitted_at is not null;
 if not found or not exists(select 1 from public.jitap_provider_reviews v where v.user_id=auth.uid() and v.status='approved') then return;end if;

 insert into public.jitap_provider_offer_windows(request_id,provider_user_id,round_id)
 select w.id,auth.uid(),coalesce(rematch.id,'00000000-0000-0000-0000-000000000000'::uuid)
 from public.website_intake w
 left join lateral (
  select c.id,c.responded_at from public.jitap_job_cancellations c
  where c.request_id=w.id and c.status='rematch_approved'
  order by c.responded_at desc limit 1
 ) rematch on true
 where w.kind='request' and w.status='new'
 and public.jitap_canonical_trade(w.payload->>'category')=any(array(select public.jitap_canonical_trade(c) from pg_catalog.unnest(p.categories) as c)) and (w.payload->>'area')=any(p.service_areas)
 and ((rematch.id is null and w.created_at>=now()-interval '59 seconds')
      or (rematch.id is not null and rematch.responded_at>=now()-interval '59 seconds'))
 and not exists(select 1 from public.jitap_provider_appointments booked where booked.request_id=w.id)
 and not exists(select 1 from public.jitap_job_cancellations banned where banned.request_id=w.id and banned.provider_user_id=auth.uid())
 and (not exists(select 1 from public.jitap_provider_buzz_responses prev where prev.request_id=w.id and prev.provider_user_id=auth.uid()) or rematch.id is not null)
 and (not exists(select 1 from public.jitap_provider_buzz_responses accepted where accepted.request_id=w.id and accepted.decision='accepted') or rematch.id is not null)
 on conflict do nothing;

 return query
 select w.id,w.payload->>'category',w.payload->>'area',
 left(coalesce(w.payload->>'preferredDate',''),30),
 left(coalesce(w.payload->>'preferredTime',''),30),w.created_at,
 left(coalesce(b.technical_summary,regexp_replace(regexp_replace(coalesce(w.payload->>'description',''),
 '([+]254|254|0)[17][0-9]{8}','[phone removed]','g'),
 '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}','[email removed]','g')),700),
 left(coalesce(b.proposed_scope,''),500),
 coalesce(b.urgency,public.jitap_reported_urgency(w.payload->>'description',w.payload->>'timing')),
 coalesce(b.source,'reported'),
 left(coalesce(w.payload->>'timing',''),30),
 left(regexp_replace(regexp_replace(coalesce(nullif(w.payload->>'locationLabel',''),w.payload->>'area','Location pending'),
 '([+]254|254|0)[17][0-9]{8}','[phone removed]','g'),
 '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}','[email removed]','g'),180)
 from public.website_intake w
 join public.jitap_provider_offer_windows offer on offer.request_id=w.id
  and offer.provider_user_id=auth.uid()
  and offer.round_id=coalesce((
   select c.id from public.jitap_job_cancellations c
   where c.request_id=w.id and c.status='rematch_approved'
   order by c.responded_at desc limit 1
  ),'00000000-0000-0000-0000-000000000000'::uuid)
  and offer.expires_at>now()
 left join public.jitap_request_service_briefs b on b.request_id=w.id
 where w.kind='request' and w.status='new' and (w.created_at>=now()-interval '7 days' or exists(select 1 from public.jitap_job_cancellations approved where approved.request_id=w.id and approved.status='rematch_approved'))
 and public.jitap_canonical_trade(w.payload->>'category')=any(array(select public.jitap_canonical_trade(c) from pg_catalog.unnest(p.categories) as c)) and (w.payload->>'area')=any(p.service_areas)
 and not exists(select 1 from public.jitap_provider_appointments a where a.request_id=w.id) and (not exists(select 1 from public.jitap_provider_buzz_responses previous where previous.request_id=w.id and previous.decision='accepted') or exists(select 1 from public.jitap_job_cancellations approved where approved.request_id=w.id and approved.status='rematch_approved')) and not exists(select 1 from public.jitap_job_cancellations banned where banned.request_id=w.id and banned.provider_user_id=auth.uid())
 and (not exists(select 1 from public.jitap_provider_buzz_responses r where r.request_id=w.id and r.provider_user_id=auth.uid()) or exists(select 1 from public.jitap_job_cancellations approved where approved.request_id=w.id and approved.status='rematch_approved'))
 order by w.created_at desc limit 100;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.jitap_provider_answer_buzz(p_request_id uuid, p_decision text, p_note text DEFAULT ''::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.jitap_provider_workspaces%rowtype;
 w public.website_intake%rowtype;
 inserted_count bigint:=0;
 scheduled_start timestamptz:=null;
 scheduled_end timestamptz:=null;
 requested_date text;
 requested_time text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_decision not in ('accepted','declined','needs_clarification') or length(coalesce(p_note,''))>500
 or (p_decision='needs_clarification' and length(trim(coalesce(p_note,'')))<3)
 then raise exception 'Invalid response' using errcode='22023';end if;
 select * into p from public.jitap_provider_workspaces where user_id=auth.uid() and is_online=true;
 if not found or not exists(select 1 from public.jitap_provider_reviews v where v.user_id=auth.uid() and v.status='approved')
 then raise exception 'Provider not approved and online' using errcode='42501';end if;
 -- Lock this exact request for the entire transaction: one and only one winner.
 select * into w from public.website_intake
 where id=p_request_id and kind='request' and status='new' and (created_at>=now()-interval '7 days' or exists(select 1 from public.jitap_job_cancellations approved where approved.request_id=p_request_id and approved.status='rematch_approved')) and (not exists(select 1 from public.jitap_provider_buzz_responses previous where previous.request_id=p_request_id and previous.decision='accepted') or exists(select 1 from public.jitap_job_cancellations approved where approved.request_id=p_request_id and approved.status='rematch_approved')) and not exists(select 1 from public.jitap_job_cancellations banned where banned.request_id=p_request_id and banned.provider_user_id=auth.uid()) and not exists(select 1 from public.jitap_provider_appointments current_job where current_job.request_id=p_request_id)
 and exists(
  select 1 from public.jitap_provider_offer_windows offer
  where offer.request_id=w.id and offer.provider_user_id=auth.uid()
  and offer.round_id=coalesce((
   select c.id from public.jitap_job_cancellations c
   where c.request_id=w.id and c.status='rematch_approved'
   order by c.responded_at desc limit 1
  ),'00000000-0000-0000-0000-000000000000'::uuid)
  and offer.expires_at>now()
 ) for update;
 if not found or not (public.jitap_canonical_trade(w.payload->>'category')=any(array(select public.jitap_canonical_trade(c) from pg_catalog.unnest(p.categories) as c)) and (w.payload->>'area')=any(p.service_areas))
 then raise exception 'This request has already been accepted or is no longer available' using errcode='P0001';end if;
 insert into public.jitap_provider_buzz_responses(request_id,provider_user_id,decision,note)
 values(p_request_id,auth.uid(),p_decision,coalesce(trim(p_note),''))
 on conflict(request_id,provider_user_id) do update set decision=excluded.decision,note=excluded.note,created_at=now() where exists(select 1 from public.jitap_job_cancellations approved where approved.request_id=p_request_id and approved.status='rematch_approved');
 get diagnostics inserted_count=row_count;
 if inserted_count<>1 then raise exception 'You have already responded to this request' using errcode='P0001';end if;
 if p_decision='accepted' then
  requested_date:=w.payload->>'preferredDate';
  requested_time:=w.payload->>'preferredTime';
  if requested_date ~ '^\d{4}-\d{2}-\d{2}$' and requested_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
   begin
    scheduled_start:=(requested_date||' '||requested_time)::timestamp at time zone 'Africa/Nairobi';
    scheduled_end:=scheduled_start+interval '1 hour';
   exception when others then
    scheduled_start:=null;scheduled_end:=null;
   end;
  end if;
  insert into public.jitap_provider_appointments(request_id,provider_user_id,starts_at,ends_at,status)
  values(p_request_id,auth.uid(),scheduled_start,scheduled_end,'confirmed');
  update public.website_intake set status='scheduled',updated_at=now() where id=p_request_id;
 end if;
 return true;
end;
$function$
;