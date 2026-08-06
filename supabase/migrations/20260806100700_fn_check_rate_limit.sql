-- Atomic increment-and-test for fixed-window rate limiting (ADR-011).
--
-- One statement does the whole job. Reading the counter and then updating it
-- from application code would be a race: two concurrent requests could both read
-- 5 and both decide they are allowed. `INSERT ... ON CONFLICT DO UPDATE
-- ... RETURNING` increments and reports the post-increment value in a single
-- atomic operation, so concurrent callers are serialised by the unique index.

create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_max_hits integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_window_ends_at timestamptz;
  v_hit_count integer;
begin
  if p_max_hits < 1 or p_window_seconds < 1 then
    raise exception 'check_rate_limit: max_hits and window_seconds must be positive';
  end if;

  -- Floor the current time to a multiple of the window length, so every caller
  -- in the same window computes the same bucket without coordination.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_window_ends_at := v_window_start + make_interval(secs => p_window_seconds);

  -- Bounded housekeeping: drop this bucket's expired windows only. Scoped to one
  -- key so the work stays constant-time rather than growing with the table.
  delete from public.rate_limit_hits
   where bucket_key = p_bucket_key
     and window_started_at < v_window_start;

  insert into public.rate_limit_hits (bucket_key, window_started_at, hit_count)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_started_at)
    do update set hit_count = rate_limit_hits.hit_count + 1,
                  updated_at = now()
  returning hit_count into v_hit_count;

  return jsonb_build_object(
    'allowed', v_hit_count <= p_max_hits,
    'hit_count', v_hit_count,
    'limit', p_max_hits,
    -- At least 1, so a Retry-After header is never "0 seconds".
    'retry_after_seconds', greatest(
      1,
      ceil(extract(epoch from (v_window_ends_at - now())))::integer
    )
  );
end;
$$;

comment on function public.check_rate_limit is
  'Atomically increments the caller''s fixed-window counter and reports whether they are within the limit. Returns { allowed, hit_count, limit, retry_after_seconds }.';

revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon;
revoke all on function public.check_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
