-- Create a table to store transaction attachment URLs
-- This allows us to manage attachments independently of the external API
CREATE TABLE public.transaction_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE,
  attachment_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since transactions don't have user ownership in external API)
CREATE POLICY "Anyone can view attachments" 
ON public.transaction_attachments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert attachments" 
ON public.transaction_attachments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update attachments" 
ON public.transaction_attachments 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete attachments" 
ON public.transaction_attachments 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_transaction_attachments_updated_at
BEFORE UPDATE ON public.transaction_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();