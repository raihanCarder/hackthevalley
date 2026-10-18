-- Persistent journal ownership is independent of temporary visitor cookies.
CREATE TABLE journal_profiles (id text PRIMARY KEY);
INSERT INTO journal_profiles (id) SELECT profile_id FROM visitor_sessions;
INSERT INTO journal_profiles (id) VALUES ('local-you') ON CONFLICT DO NOTHING;

ALTER TABLE daily_entries DROP CONSTRAINT daily_entries_profile_id_fkey;
ALTER TABLE daily_entries ADD CONSTRAINT daily_entries_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES journal_profiles(id);
-- Keep historical sessions and their records intact; the local app no longer creates sessions.
