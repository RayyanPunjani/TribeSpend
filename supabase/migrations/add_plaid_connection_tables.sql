CREATE TABLE IF NOT EXISTS public.plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  item_id text NOT NULL UNIQUE,
  institution_id text,
  institution_name text,
  status text NOT NULL DEFAULT 'active',
  last_cursor text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plaid_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_item_id uuid NOT NULL REFERENCES public.plaid_items(id) ON DELETE CASCADE,
  plaid_account_id text NOT NULL UNIQUE,
  card_id text,
  name text,
  official_name text,
  type text,
  subtype text,
  mask text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.synced_transaction_ids (
  plaid_transaction_id text PRIMARY KEY,
  plaid_account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plaid_items_household_status_idx
ON public.plaid_items (household_id, status);

CREATE INDEX IF NOT EXISTS plaid_accounts_item_idx
ON public.plaid_accounts (plaid_item_id);

CREATE INDEX IF NOT EXISTS synced_transaction_ids_account_idx
ON public.synced_transaction_ids (plaid_account_id);
