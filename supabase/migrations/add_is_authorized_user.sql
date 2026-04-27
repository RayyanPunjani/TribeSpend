ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS is_authorized_user boolean DEFAULT false;
