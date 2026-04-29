ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
