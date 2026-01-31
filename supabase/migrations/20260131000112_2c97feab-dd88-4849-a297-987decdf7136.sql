-- Create a table for day labor weekly attachments
CREATE TABLE public.day_labor_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_ending_date DATE NOT NULL UNIQUE,
  attachment_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.day_labor_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view day labor attachments" 
ON public.day_labor_attachments 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert day labor attachments" 
ON public.day_labor_attachments 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update day labor attachments" 
ON public.day_labor_attachments 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete day labor attachments" 
ON public.day_labor_attachments 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_day_labor_attachments_updated_at
BEFORE UPDATE ON public.day_labor_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();