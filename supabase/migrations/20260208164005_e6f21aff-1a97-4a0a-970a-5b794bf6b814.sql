-- Add authorship tracking columns to cronograma_entries
ALTER TABLE cronograma_entries 
ADD COLUMN created_by uuid,
ADD COLUMN updated_by uuid;

-- Add index for efficient filtering by editor
CREATE INDEX idx_cronograma_entries_updated_by ON cronograma_entries(updated_by);