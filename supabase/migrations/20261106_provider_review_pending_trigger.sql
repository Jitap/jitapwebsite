-- Initialize review records only when a provider submits onboarding.
create or replace function public.jitap_queue_provider_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.submitted_at is not null then
  insert into public.jitap_provider_reviews(user_id,status)
  values(new.user_id,'pending') on conflict(user_id) do nothing;
 end if;
 return new;
end;$$;
revoke all on function public.jitap_queue_provider_review() from PUBLIC,anon,authenticated;
drop trigger if exists jitap_queue_provider_review on public.jitap_provider_workspaces;
create trigger jitap_queue_provider_review after insert or update of submitted_at
on public.jitap_provider_workspaces for each row
execute function public.jitap_queue_provider_review();