-- Fix cedenojord's user_roles entry: assign them to the only active entity
UPDATE public.user_roles
SET entity_id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'cedenojord@internal.jord.local')
  AND entity_id IS NULL;