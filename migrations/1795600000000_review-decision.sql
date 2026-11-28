-- Up Migration

-- The TA's decision on a verdict, kept apart from the proposal of the hard rules or the model
-- (`verdict`, `evidence`). `deduction`, `is_reviewed`, `reviewed_by` and `reviewed_at` describe
-- the same decision. NULL means no TA has decided yet.
ALTER TABLE verdicts ADD COLUMN IF NOT EXISTS decision VARCHAR(16) CHECK (decision IN ('pass', 'violation'));
ALTER TABLE verdicts ADD COLUMN IF NOT EXISTS decision_evidence JSONB;

-- Down Migration

ALTER TABLE verdicts DROP COLUMN IF EXISTS decision_evidence;
ALTER TABLE verdicts DROP COLUMN IF EXISTS decision;
