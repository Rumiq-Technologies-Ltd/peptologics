-- Fixed-window rate limiting for public endpoints (ADR-011).
--
-- Postgres rather than Redis: at this traffic a single indexed upsert is
-- indistinguishable from Upstash, and it adds no infrastructure, no vendor, and
-- no secret. `@upstash/ratelimit` is the documented upgrade path.
--
-- `bucket_key` is a salted SHA-256 of the client IP, hashed in Node before it
-- ever reaches the database (src/lib/security/request.ts). The counter needs a
-- stable key, not an identity, so storing a raw address would be PII held for no
-- reason.

create table public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),

  bucket_key text not null,

  -- Start of the fixed window, floored to a multiple of the window length. Two
  -- requests in the same window collide on the unique constraint and increment.
  window_started_at timestamptz not null,

  hit_count integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rate_limit_hits_unique_window unique (bucket_key, window_started_at),
  constraint rate_limit_hits_count_positive check (hit_count > 0),
  constraint rate_limit_hits_key_length check (length(bucket_key) between 16 and 200)
);

comment on table public.rate_limit_hits is
  'Fixed-window abuse counters. bucket_key is a salted hash of the client IP — no raw address is ever stored.';

-- Supports the housekeeping delete in check_rate_limit().
create index rate_limit_hits_window_idx on public.rate_limit_hits (window_started_at);

create trigger rate_limit_hits_set_updated_at
  before update on public.rate_limit_hits
  for each row execute function public.set_updated_at();

-- RLS: enabled with no policies. Only the service role touches this table.
alter table public.rate_limit_hits enable row level security;
