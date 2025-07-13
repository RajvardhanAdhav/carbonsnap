-- Update the scan_method check constraint to include 'barcode'
ALTER TABLE public.scanned_items 
DROP CONSTRAINT IF EXISTS scanned_items_scan_method_check;

ALTER TABLE public.scanned_items 
ADD CONSTRAINT scanned_items_scan_method_check 
CHECK (scan_method IN ('camera', 'manual', 'barcode'));