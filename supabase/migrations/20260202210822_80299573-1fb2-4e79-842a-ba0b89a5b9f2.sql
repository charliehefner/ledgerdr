-- Add attachment_category column to support multiple attachment types per transaction
-- Categories: 'ncf' (fiscal document), 'payment_receipt' (comprobante de pago), 'quote' (cotización)

-- First, add the category column to the existing table
ALTER TABLE public.transaction_attachments 
ADD COLUMN IF NOT EXISTS attachment_category TEXT NOT NULL DEFAULT 'payment_receipt';

-- Drop the existing unique constraint on transaction_id (if it exists)
ALTER TABLE public.transaction_attachments 
DROP CONSTRAINT IF EXISTS transaction_attachments_transaction_id_key;

-- Add a composite unique constraint for transaction_id + category
-- This allows multiple attachments per transaction but only one per category
ALTER TABLE public.transaction_attachments 
ADD CONSTRAINT transaction_attachments_transaction_id_category_key 
UNIQUE (transaction_id, attachment_category);

-- Add a check constraint for valid categories
ALTER TABLE public.transaction_attachments 
ADD CONSTRAINT valid_attachment_category 
CHECK (attachment_category IN ('ncf', 'payment_receipt', 'quote'));

-- Update existing records to be 'payment_receipt' (already the default, but explicit)
UPDATE public.transaction_attachments 
SET attachment_category = 'payment_receipt' 
WHERE attachment_category IS NULL OR attachment_category = '';

-- Create an index for faster lookups by category
CREATE INDEX IF NOT EXISTS idx_transaction_attachments_category 
ON public.transaction_attachments (attachment_category);

-- Add a comment for documentation
COMMENT ON COLUMN public.transaction_attachments.attachment_category IS 'Type of attachment: ncf (fiscal document), payment_receipt (comprobante de pago), quote (cotización)';