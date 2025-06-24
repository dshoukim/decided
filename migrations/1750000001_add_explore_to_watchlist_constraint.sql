-- Migration: Add 'explore' as valid option for watch_list.added_from constraint
-- Date: 2025-06-24

-- Drop the existing constraint
ALTER TABLE watch_list DROP CONSTRAINT IF EXISTS added_from_check;

-- Add the updated constraint with 'explore' included
ALTER TABLE watch_list ADD CONSTRAINT added_from_check 
  CHECK (added_from IN ('survey', 'search', 'manual', 'decided_together', 'explore'));

-- Update any existing records that might have 'manual' from explore to 'explore'
-- (This is optional since we just switched to 'manual' temporarily)
UPDATE watch_list 
SET added_from = 'explore', updated_at = NOW() 
WHERE added_from = 'manual' 
  AND created_at > '2025-06-24 20:30:00'::timestamp
  AND user_note IS NULL; 