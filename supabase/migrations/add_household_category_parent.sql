ALTER TABLE public.household_categories
ADD COLUMN IF NOT EXISTS parent_category text;
