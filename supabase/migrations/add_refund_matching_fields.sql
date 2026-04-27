ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS refund_for_id uuid REFERENCES public.transactions(id),
ADD COLUMN IF NOT EXISTS has_refund boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS refund_review_pending boolean DEFAULT false;
