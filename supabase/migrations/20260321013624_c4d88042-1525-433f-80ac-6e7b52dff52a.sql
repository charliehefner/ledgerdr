ALTER TABLE public.ap_ar_documents
ADD CONSTRAINT ap_ar_documents_status_check
CHECK (status IN ('open', 'partial', 'paid', 'void'));