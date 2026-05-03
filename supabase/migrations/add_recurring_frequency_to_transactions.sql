ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS recurring_frequency text
CHECK (
  recurring_frequency IS NULL
  OR recurring_frequency IN ('weekly', 'monthly', 'yearly')
);
