ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS reimbursement_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS reimbursement_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS reimbursement_to text,
ADD COLUMN IF NOT EXISTS reimbursement_paid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reimbursement_note text;
