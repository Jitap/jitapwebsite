create or replace function public.jitap_provider_confirm_eta(p_appointment_id uuid,p_eta_at timestamptz)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare a public.jitap_provider_appointments%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into a from public.jitap_provider_appointments
 where id=p_appointment_id and provider_user_id=auth.uid() for update;
 if not found then raise exception 'Appointment not found' using errcode='P0001';end if;
 if a.status not in ('confirmed','on_my_way') then raise exception 'Only active scheduled work can confirm an ETA' using errcode='P0001';end if;
 if p_eta_at is null or p_eta_at<now()+interval '1 minute' or p_eta_at>now()+interval '48 hours' then
  raise exception 'Choose an arrival time between 1 minute and 48 hours from now' using errcode='22023';
 end if;
 if a.provider_eta_at is not null and abs(extract(epoch from (a.provider_eta_at-p_eta_at)))<300 then
  return a.provider_eta_at;
 end if;
 update public.jitap_provider_appointments set provider_eta_at=p_eta_at,updated_at=now()
 where id=p_appointment_id;
 return p_eta_at;
end $$;
revoke all on function public.jitap_provider_confirm_eta(uuid,timestamptz) from public,anon;
grant execute on function public.jitap_provider_confirm_eta(uuid,timestamptz) to authenticated,service_role;
