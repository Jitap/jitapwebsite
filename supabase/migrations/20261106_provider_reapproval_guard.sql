-- Changes to the approved skills/coverage require a fresh human review.
create or replace function public.jitap_reset_provider_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (
  old.full_name is distinct from new.full_name or
  old.business_name is distinct from new.business_name or
  old.categories is distinct from new.categories or
  old.service_areas is distinct from new.service_areas or
  old.base_area is distinct from new.base_area or
  old.experience_years is distinct from new.experience_years or
  old.skills is distinct from new.skills
 ) then
  update public.jitap_provider_reviews
  set status='pending',reviewed_at=null,updated_at=now()
  where user_id=new.user_id and status='approved';
  new.is_online=false;
 end if;
 return new;
end;$$;
revoke all on function public.jitap_reset_provider_review() from PUBLIC,anon,authenticated;
drop trigger if exists jitap_reset_review on public.jitap_provider_workspaces;
create trigger jitap_reset_review before update of full_name,business_name,categories,service_areas,base_area,experience_years,skills
on public.jitap_provider_workspaces for each row execute function public.jitap_reset_provider_review();