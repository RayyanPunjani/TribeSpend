ALTER TABLE public.category_rules
ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.cards(id),
ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id);
