-- mannequin-v2: realistic body map with facial features, each finger, and each toe (45 regions).
-- Existing mannequin-v1 rows remain valid stored data; the application refuses to restore them on the new body
-- rather than reinterpreting their maps. New saves are mannequin-v2.
ALTER TABLE daily_entries DROP CONSTRAINT IF EXISTS daily_entries_body_map_version_check;
ALTER TABLE daily_entries ADD CONSTRAINT daily_entries_body_map_version_check
  CHECK (body_map_version IN ('mannequin-v1', 'mannequin-v2'));

ALTER TABLE regional_observations DROP CONSTRAINT IF EXISTS regional_observations_region_id_check;
ALTER TABLE regional_observations ADD CONSTRAINT regional_observations_region_id_check CHECK (region_id IN (
    'head', 'neck', 'front-upper-torso', 'front-lower-torso', 'back-upper-torso',
    'back-lower-torso', 'pelvis', 'left-upper-arm', 'right-upper-arm', 'left-forearm',
    'right-forearm', 'left-hand', 'right-hand', 'left-thigh', 'right-thigh',
    'left-calf', 'right-calf', 'left-foot', 'right-foot', 'left-eye',
    'right-eye', 'nose', 'mouth', 'left-ear', 'right-ear',
    'left-thumb', 'right-thumb', 'left-index-finger', 'right-index-finger', 'left-middle-finger',
    'right-middle-finger', 'left-ring-finger', 'right-ring-finger', 'left-little-finger', 'right-little-finger',
    'left-big-toe', 'right-big-toe', 'left-second-toe', 'right-second-toe', 'left-third-toe',
    'right-third-toe', 'left-fourth-toe', 'right-fourth-toe', 'left-little-toe', 'right-little-toe'
));
