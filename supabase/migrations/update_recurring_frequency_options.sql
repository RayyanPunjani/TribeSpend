ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS recurring_frequency text;

DO $$
BEGIN
  ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_recurring_frequency_check;

  ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_recurring_frequency_check
    CHECK (
      recurring_frequency IS NULL
      OR recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'semi_annually', 'yearly')
    );
END $$;
