ALTER TABLE public.household_categories
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
