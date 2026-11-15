-- Retain safe factual service-photo observations separately from customer descriptions.
alter table public.jitap_request_photos add column if not exists ai_observation text;
comment on column public.jitap_request_photos.ai_observation is 'Factual AI visual observation only, not a diagnosis; separate from customer-reported text.';
