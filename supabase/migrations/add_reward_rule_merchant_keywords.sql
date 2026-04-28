ALTER TABLE public.card_reward_rules
ADD COLUMN IF NOT EXISTS merchant_keywords text[];
