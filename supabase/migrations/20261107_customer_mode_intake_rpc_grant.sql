-- The customer-authorized intake RPC is invoked only from the trusted Next.js
-- API using the private 64-byte INTAKE_RPC_TOKEN and a Supabase anon key.
-- Its body rechecks that token in submit_website_intake_authorized; restore
-- the same narrow PostgREST EXECUTE access used before this migration.
grant execute on function public.submit_website_intake_customer_authorized(text,jsonb,text,text,text,uuid) to anon;
