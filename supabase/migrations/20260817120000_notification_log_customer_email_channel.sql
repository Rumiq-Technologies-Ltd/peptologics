-- Admits the customer confirmation as a logged notification channel (ADR-027).
--
-- The confirmation email sent to the person who filled the inquiry form is a delivery
-- that can fail, and a failure matters: the lead is safe either way, but a customer with
-- no written record is a customer who does not know whether the form worked. Recording it
-- in `notification_log` puts it in the same dead-letter list as the internal notification,
-- so an operator can see which of the two went missing rather than only that something did.
--
-- Why a second channel rather than a second recipient on the existing one: the two fail
-- independently. One Resend call to the company inbox and one to the customer succeed or
-- fail separately, and `notification_log` is keyed `(order_id, channel)` — a single row
-- could only record one verdict for two sends, which is precisely the ambiguity the table
-- exists to remove.
--
-- `'whatsapp'` stays in the permitted set. It is unused (ADR-023) and no row has ever
-- carried it, but this constraint guards a log — a record of what happened — and
-- narrowing what history is allowed to say is not this migration's business.

alter table public.notification_log
  drop constraint notification_log_channel_valid;

alter table public.notification_log
  add constraint notification_log_channel_valid
  check (channel in ('email', 'customer_email', 'whatsapp'));

comment on column public.notification_log.channel is
  'email = internal notification to the company. customer_email = confirmation to the customer who submitted (ADR-027). whatsapp is retained for historical rows only and is unused (ADR-023).';
