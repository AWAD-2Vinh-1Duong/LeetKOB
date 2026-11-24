-- Up Migration

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'ta', 'student')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_enrollments (
    id SERIAL PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_class_enrollments UNIQUE (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON class_enrollments(student_id);

CREATE TABLE IF NOT EXISTS labs (
    id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    statement TEXT NOT NULL,
    tests JSONB NOT NULL DEFAULT '[]'::jsonb,
    constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
    deadline TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_labs_class_id ON labs(class_id);

CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(64) PRIMARY KEY,
    lab_id VARCHAR(64) NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(16) NOT NULL DEFAULT 'cpp',
    source TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'compiling', 'running', 'judged', 'failed')),
    idempotency_key VARCHAR(255) NOT NULL,
    fingerprint CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_idempotency ON submissions (student_id, lab_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_submissions_lab_student ON submissions(lab_id, student_id);

CREATE TABLE IF NOT EXISTS judge_jobs (
    id VARCHAR(64) PRIMARY KEY,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_judge_jobs_queue ON judge_jobs(status, created_at) WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS verdicts (
    id VARCHAR(64) PRIMARY KEY,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    constraint_id VARCHAR(64) NOT NULL,
    verdict VARCHAR(32) NOT NULL CHECK (verdict IN ('pass', 'violation', 'unsure')),
    evidence JSONB,
    deduction NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verdicts_submission_id ON verdicts(submission_id);

CREATE TABLE IF NOT EXISTS llm_call_logs (
    id VARCHAR(64) PRIMARY KEY,
    submission_id VARCHAR(64) REFERENCES submissions(id) ON DELETE SET NULL,
    provider VARCHAR(64) NOT NULL DEFAULT 'gemini',
    provider_request_id VARCHAR(255),
    model VARCHAR(64) NOT NULL DEFAULT 'gemini-3.6-flash',
    prompt TEXT NOT NULL,
    response TEXT,
    input_tokens INT NOT NULL DEFAULT 0,
    output_tokens INT NOT NULL DEFAULT 0,
    latency_ms INT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_call_logs_submission_id ON llm_call_logs(submission_id);

-- Down Migration

DROP TABLE IF EXISTS llm_call_logs CASCADE;
DROP TABLE IF EXISTS verdicts CASCADE;
DROP TABLE IF EXISTS judge_jobs CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS labs CASCADE;
DROP TABLE IF EXISTS class_enrollments CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
