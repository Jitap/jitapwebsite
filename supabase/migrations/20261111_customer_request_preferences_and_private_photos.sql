-- JiTap customer photo uploads and persistent first-request preferences.
alter table public.jitap_accounts
 add column if not exists privacy_accepted_at timestamptz,
 add column if not exists sms_updates_opt_in boolean,
 add column if not exists whatsapp_updates_opt_in boolean,
 add column if not exists request_preferences_set_at timestamptz;

create table if not exists public.jitap_request_photos (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.website_intake(id) on delete cascade,
 object_path text not null unique,
 mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
 size_bytes integer not null check (size_bytes>0 and size_bytes<=5242880),
 created_at timestamptz not null default now()
);
create index if not exists jitap_request_photos_request_idx on public.jitap_request_photos(request_id);
alter table public.jitap_request_photos enable row level security;
revoke all on public.jitap_request_photos from anon, authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('jitap-request-private','jitap-request-private',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
