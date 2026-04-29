CREATE TABLE IF NOT EXISTS public.household_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  name text NOT NULL,
  color text,
  icon text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS household_categories_household_name_idx
ON public.household_categories (household_id, lower(name));
