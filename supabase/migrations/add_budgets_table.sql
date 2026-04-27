-- Run this in Supabase SQL Editor when switching from mock to live mode

CREATE TABLE IF NOT EXISTS budgets (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       uuid          NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id          uuid          REFERENCES people(id) ON DELETE SET NULL,
  category           text,
  label              text          NOT NULL,
  amount             numeric(10,2) NOT NULL,
  period             text          NOT NULL CHECK (period IN ('weekly', 'monthly', 'annual')),
  notify_email       text,
  -- notify_thresholds stores an array of % values, e.g. [50, 80, 100]
  notify_thresholds  jsonb         NOT NULL DEFAULT '[80, 100]',
  created_at         timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can manage budgets"
  ON budgets
  FOR ALL
  USING  (household_id = get_my_household_id())
  WITH CHECK (household_id = get_my_household_id());
