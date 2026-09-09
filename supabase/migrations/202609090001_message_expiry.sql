-- Run once in the existing project's Supabase SQL Editor, as postgres.
-- Keeps the existing table, content, slugs and permissive SELECT/INSERT policies.
-- https://supabase.com/docs/guides/cron/quickstart
begin;
create extension if not exists pg_cron;
create index if not exists messages_created_at_idx on public.messages (created_at);
alter table public.messages enable row level security;

-- A restrictive policy is ANDed with existing policies, even broad SELECT ones.
drop policy if exists messages_unexpired_only on public.messages;
create policy messages_unexpired_only on public.messages
  as restrictive for select to anon, authenticated
  using (created_at > now() - interval '72 hours' and created_at <= now());

-- Clients may not extend lifetime by supplying or changing created_at.
create or replace function public.stamp_message_created_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    NEW.created_at := statement_timestamp();
  else
    NEW.created_at := OLD.created_at;
  end if;
  return NEW;
end;
$$;
revoke all on function public.stamp_message_created_at() from public, anon, authenticated;
drop trigger if exists messages_created_at_guard on public.messages;
create trigger messages_created_at_guard before insert or update on public.messages
  for each row execute function public.stamp_message_created_at();

-- No browser deletion privileges or service-role keys. Runs inside Postgres.
revoke delete, update on public.messages from anon, authenticated;
select cron.schedule('particle-message-expiry', '*/15 * * * *',
  $$delete from public.messages where created_at <= now() - interval '72 hours'$$);
commit;
