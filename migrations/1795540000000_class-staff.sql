-- Up Migration

-- Which TAs teach which class. A TA sees only the labs of these classes.
CREATE TABLE IF NOT EXISTS class_staff (
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_class_staff_user ON class_staff(user_id);

-- Down Migration

DROP TABLE IF EXISTS class_staff CASCADE;
