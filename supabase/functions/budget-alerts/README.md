# Budget Alerts Edge Function

Sends budget threshold email alerts through Resend.

## Required Environment

Supabase Edge Functions automatically provide:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not manually set `SUPABASE_SERVICE_ROLE_KEY` as a project secret, and never expose it to frontend code. The function uses it only server-side so budget reads and writes can bypass RLS.

Set the Resend API key before deploying:

```sh
supabase secrets set RESEND_API_KEY=your-resend-api-key
```

## Deploy

```sh
supabase functions deploy budget-alerts
```

## Schedule

Suggested schedule: run daily at 9 AM.

For example, configure a Supabase scheduled function or external cron job to call:

```sh
curl -X POST "https://<project-ref>.functions.supabase.co/budget-alerts" \
  -H "Authorization: Bearer <anon-or-service-token>"
```

## Behavior

The function checks budgets with `notify_email`, calculates current-period spend, sends only the highest crossed threshold that has not already been notified for the current period, and updates `last_notified_threshold` plus `last_notified_at` after Resend accepts the email.
