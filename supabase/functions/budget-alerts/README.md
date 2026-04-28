# Budget Alerts Edge Function

Sends budget threshold email alerts through Resend.

## Required Secrets

Set these secrets in Supabase before deploying:

```sh
supabase secrets set SUPABASE_URL=your-project-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set RESEND_API_KEY=your-resend-api-key
```

`SUPABASE_SERVICE_ROLE_KEY` must never be exposed to frontend code. It belongs only in Supabase Edge Function secrets or other trusted server environments.

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
