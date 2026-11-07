-- Provider identity documents and branding remain PRIVATE (not public assets).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('jitap-provider-private','jitap-provider-private',false,5242880,array['image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png'];

create table if not exists public.jitap_provider_media(
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('profile_photo','business_logo','id_front','id_back')),
 object_path text not null,
 content_type text not null check(content_type in ('image/jpeg','image/png')),
 uploaded_at timestamptz not null default now(),
 primary key(user_id,kind)
);
alter table public.jitap_provider_media enable row level security;
revoke all on public.jitap_provider_media from public,anon,authenticated;
create index if not exists jitap_provider_media_user_idx on public.jitap_provider_media(user_id);

-- A staff approval only succeeds when both identity images are present.
-- No approval by the provider, and an approval cannot be inferred from just
-- having uploaded images; staff must perform a separate review.
create or replace function public.jitap_guard_provider_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='approved' then
  if not exists(select 1 from public.jitap_provider_workspaces w
     where w.user_id=new.user_id and w.submitted_at is not null) or
     not exists(select 1 from public.jitap_provider_media m where m.user_id=new.user_id and m.kind='id_front') or
     not exists(select 1 from public.jitap_provider_media m where m.user_id=new.user_id and m.kind='id_back')
  then raise exception 'Both national ID images and submitted profile required before approval' using errcode='23514';end if;
 end if;
 return new;
end;$$;
revoke all on function public.jitap_guard_provider_review() from public,anon,authenticated;
drop trigger if exists jitap_guard_provider_review on public.jitap_provider_reviews;
create trigger jitap_guard_provider_review before update of status on public.jitap_provider_reviews
for each row execute function public.jitap_guard_provider_review();
