-- Record explicit consent alongside each sensitive national ID upload.
alter table public.jitap_provider_media
 add column if not exists consented_at timestamptz;
alter table public.jitap_provider_media
 drop constraint if exists jitap_provider_id_consent_required;
alter table public.jitap_provider_media
 add constraint jitap_provider_id_consent_required check(
 kind not in ('id_front','id_back') or consented_at is not null
);
