-- Add is_holiday column to employee_timesheets table
ALTER TABLE public.employee_timesheets
ADD COLUMN is_holiday boolean NOT NULL DEFAULT false;