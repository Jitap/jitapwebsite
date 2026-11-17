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
  where offer.request_id=p_request_id and offer.provider_user_id=auth.uid()
  and offer.round_id=coalesce((
   select c.id from public.jitap_job_cancellations c
   where c.request_id=p_request_id and c.status='rematch_approved'
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
  update public.jitap_wave_dispatch_jobs set state='matched',accepted_at=now(),updated_at=now()
    where request_id=p_request_id and state='searching';
  update public.jitap_wave_offers set state='dismissed'
    where request_id=p_request_id and state='pending';
 end if;
 return true;
end;
$function$
