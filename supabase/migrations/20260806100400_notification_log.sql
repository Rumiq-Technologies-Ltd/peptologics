-- Delivery record for inquiry notifications, one row per order per channel.
--
-- This table is what makes notification failure survivable. The order is
-- committed first; create_inquiry() then writes a `pending` row per channel, and
-- the notification service updates it to sent / failed / skipped. Nothing can
-- throw its way back into the order transaction.
--
-- The partial index on `failed` doubles as a replayable dead-letter list: an
-- operator can see exactly which leads were never delivered.

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null,

  channel text not null,
  status text not null default 'pending',

  -- Provider-side id (Resend message id, Meta message id) for support tickets.
  provider_message_id text,

  -- Technical detail for the operator. Never shown to a customer.
  error_message text,
  attempts integer not null default 0,

  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_log_order_fk
    foreign key (order_id) references public.orders (id) on delete cascade,

  constraint notification_log_one_row_per_channel unique (order_id, channel),

  constraint notification_log_channel_valid check (channel in ('email', 'whatsapp')),

  -- `skipped` is a first-class outcome, not an error: it is what a channel with
  -- no credentials configured records. Distinguishing it from `failed` is what
  -- keeps the dead-letter list meaningful before Resend and Meta are set up.
  constraint notification_log_status_valid check (
    status in ('pending', 'sent', 'failed', 'skipped')
  ),

  constraint notification_log_attempts_nonnegative check (attempts >= 0),
  constraint notification_log_error_length check (
    error_message is null or length(error_message) <= 1000
  )
);

comment on table public.notification_log is
  'One row per order per channel. Written as `pending` inside create_inquiry, then updated by the notification service. The partial index on failed rows is the dead-letter list.';
comment on column public.notification_log.status is
  'pending | sent | failed | skipped. `skipped` means the channel has no credentials configured — expected, not an error.';

-- The dead-letter list. Partial, so it stays tiny regardless of table size.
create index notification_log_failed_idx
  on public.notification_log (created_at desc)
  where status in ('pending', 'failed');

create index notification_log_order_id_idx on public.notification_log (order_id);

create trigger notification_log_set_updated_at
  before update on public.notification_log
  for each row execute function public.set_updated_at();

-- RLS: enabled with no policies. Rows reference an order and may contain a
-- provider error that echoes customer data.
alter table public.notification_log enable row level security;
