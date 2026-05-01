ALTER TABLE public.cards
ADD COLUMN IF NOT EXISTS is_custom_name boolean DEFAULT false;
