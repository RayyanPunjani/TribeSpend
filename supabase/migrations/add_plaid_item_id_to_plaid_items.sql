ALTER TABLE public.plaid_items
ADD COLUMN IF NOT EXISTS plaid_item_id text;
