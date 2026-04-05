
-- Rename entity from "Operaciones Agrícolas" to "Jord Dominicana"
UPDATE public.entities 
SET name = 'Jord Dominicana', updated_at = now()
WHERE id = '30e1a5d7-e5c5-4f79-bf7d-202b62a52fcf';

-- Promote admin users to global admins by setting entity_id to NULL
UPDATE public.user_roles 
SET entity_id = NULL 
WHERE role = 'admin';
