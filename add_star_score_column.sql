ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS star_method_score numeric DEFAULT 0;

COMMENT ON COLUMN submissions.star_method_score IS 'Score 0-10 for STAR Method competency';
