-- Add unique constraint for upsert on employee_timesheets
ALTER TABLE public.employee_timesheets 
ADD CONSTRAINT employee_timesheets_employee_date_unique 
UNIQUE (employee_id, work_date);