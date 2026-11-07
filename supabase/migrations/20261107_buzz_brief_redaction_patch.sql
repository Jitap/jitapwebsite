create or replace function public.jitap_provider_available_buzz()
returns table(
 request_id uuid,category text,area text,preferred_date text,preferred_time text,created_at timestamptz,
 technical_summary text,proposed_scope text,urgency text,brief_source text,requested_timing text
)
language plpgsql security definer set search_path='' as $$
declare p public.jitap_provider_workspaces%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into p from public.jitap_provider_workspaces
 where user_id=auth.uid() and is_online=true and submitted_at is not null;
 if not found or not exists(select 1 from public.jitap_provider_reviews v where v.user_id=auth.uid() and v.status='approved') then return;end if;
 return query
 select
  w.id,w.payload->>'category',w.payload->>'area',
  left(coalesce(w.payload->>'preferredDate',''),30),
  left(coalesce(w.payload->>'preferredTime',''),30),w.created_at,
  -- Existing requests without an AI brief retain an explicitly labeled
  -- customer-reported description, never a fabricated technical diagnosis.
  left(coalesce(b.technical_summary,
    regexp_replace(regexp_replace(coalesce(w.payload->>'description',''),
      '([+]254|254|0)[17][0-9]{8}','[phone removed]','g'),
      '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}','[email removed]','g')
  ),700),
  left(coalesce(b.proposed_scope,''),500),
  coalesce(b.urgency,public.jitap_reported_urgency(w.payload->>'description',w.payload->>'timing')),
  coalesce(b.source,'reported'),
  left(coalesce(w.payload->>'timing',''),30)
 from public.website_intake w
 left join public.jitap_request_service_briefs b on b.request_id=w.id
 where w.kind='request' and w.status='new' and w.created_at>=now()-interval '7 days'
  and (w.payload->>'category')=any(p.categories)
  and (w.payload->>'area')=any(p.service_areas)
  and not exists(select 1 from public.jitap_provider_buzz_responses r where r.request_id=w.id and r.provider_user_id=auth.uid())
 order by w.created_at desc limit 30;
end;$$;
revoke all on function public.jitap_provider_available_buzz() from PUBLIC,anon;
grant execute on function public.jitap_provider_available_buzz() to authenticated;
