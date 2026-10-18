CREATE TABLE IF NOT EXISTS visitor_sessions (
  token_hash bytea PRIMARY KEY,
  profile_id text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_entries (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL REFERENCES visitor_sessions(profile_id),
  local_date date NOT NULL,
  time_zone text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  body_map_version text NOT NULL CHECK (body_map_version = 'mannequin-v1'),
  maps jsonb NOT NULL CHECK (jsonb_typeof(maps) = 'object'),
  note text CHECK (char_length(note) <= 4000),
  UNIQUE (profile_id, local_date)
);

CREATE TABLE IF NOT EXISTS regional_observations (
  entry_id uuid NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  region_id text NOT NULL CHECK (region_id IN (
    'head', 'neck', 'front-upper-torso', 'front-lower-torso', 'back-upper-torso',
    'back-lower-torso', 'pelvis', 'left-upper-arm', 'right-upper-arm',
    'left-forearm', 'right-forearm', 'left-hand', 'right-hand', 'left-thigh',
    'right-thigh', 'left-calf', 'right-calf', 'left-foot', 'right-foot'
  )),
  pain_type text NOT NULL CHECK (pain_type IN ('burning', 'sharp', 'aching', 'tingling')),
  mean_intensity double precision NOT NULL CHECK (mean_intensity BETWEEN 0 AND 10),
  peak_intensity double precision NOT NULL CHECK (peak_intensity BETWEEN mean_intensity AND 10),
  map_coverage double precision NOT NULL CHECK (map_coverage BETWEEN 0 AND 1),
  PRIMARY KEY (entry_id, region_id, pain_type)
);
