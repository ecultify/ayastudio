// Idempotent schema for the Anya Studio Postgres database.
// Kept as a string (not a .sql file) so Turbopack bundles it without a runtime
// file read. ensureSchema() runs this once per process; every statement is
// IF NOT EXISTS so it's safe to run on every cold start.

export const SCHEMA_SQL = /* sql */ `
-- Knowledge base folders. The AI can create folders to organise a long
-- document into multiple focused notes. folder_id NULL on a file = root.
CREATE TABLE IF NOT EXISTS kb_folders (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- "upload" (real uploaded file lives here) or "ai" (AI-generated notes)
  kind        TEXT NOT NULL DEFAULT 'ai',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every item in the knowledge base: uploaded files AND AI-generated notes
-- (markdown extracted/derived from a parent document).
CREATE TABLE IF NOT EXISTS kb_files (
  id           TEXT PRIMARY KEY,
  folder_id    TEXT REFERENCES kb_folders(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  tag          TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'Other',
  usefulness   TEXT NOT NULL DEFAULT 'Medium',
  score        INTEGER NOT NULL DEFAULT 50,
  summary      TEXT NOT NULL DEFAULT '',
  reason       TEXT NOT NULL DEFAULT '',
  mime         TEXT NOT NULL DEFAULT '',
  size         BIGINT NOT NULL DEFAULT 0,
  -- Extracted/derived text content (markdown or plain text) the AI can read.
  content_text TEXT NOT NULL DEFAULT '',
  -- Small data-URL thumbnail for images.
  thumb        TEXT,
  -- "file" (uploaded) or "note" (AI-generated markdown derived from a doc).
  kind         TEXT NOT NULL DEFAULT 'file',
  -- For AI notes: the kb_files.id of the source document they were derived from.
  derived_from TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kb_files_folder_idx ON kb_files(folder_id);
CREATE INDEX IF NOT EXISTS kb_files_category_idx ON kb_files(category);

-- Ask Anya chat sessions + their messages.
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id, created_at);

-- Persisted Pulse reports (history). The full scan snapshot lives in payload.
CREATE TABLE IF NOT EXISTS reports (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  date_label   TEXT NOT NULL DEFAULT '',
  relevance    INTEGER NOT NULL DEFAULT 0,
  flags        INTEGER NOT NULL DEFAULT 0,
  summary      TEXT NOT NULL DEFAULT '',
  payload      JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_generated_idx ON reports(generated_at DESC);

-- Latest full scan snapshot (single row, id='current') so the dashboard
-- survives restarts instead of re-scanning on every cold boot.
CREATE TABLE IF NOT EXISTS scan_state (
  id           TEXT PRIMARY KEY,
  payload      JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Editable creator watchlist (seeded from defaults on first run).
CREATE TABLE IF NOT EXISTS watchlist (
  id         TEXT PRIMARY KEY,
  handle     TEXT NOT NULL,
  name       TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  followers  TEXT NOT NULL DEFAULT '—',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calendar posts (content plan), persisted instead of localStorage.
CREATE TABLE IF NOT EXISTS calendar_events (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  format     TEXT NOT NULL DEFAULT 'Reel',
  pillar     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'Planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calendar_events_date_idx ON calendar_events(date);
`
