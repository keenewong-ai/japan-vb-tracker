-- japan-vb-tracker schema (applied via Supabase migration init_japan_vb_tracker_schema)
-- Recreated for local reference. country_code widened to text to allow codes like "asia".

CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  country_code TEXT,
  flag_path TEXT,
  gender TEXT CHECK (gender IN ('men','women','mixed') OR gender IS NULL)
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  league_id TEXT REFERENCES leagues(id),
  logo_path TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('men','women')),
  position TEXT,
  team_id TEXT REFERENCES teams(id),
  league_id TEXT REFERENCES leagues(id),
  nationality TEXT,
  hometown TEXT,
  birth_date DATE,
  height_cm INT,
  weight_kg INT,
  spike_cm INT,
  block_cm INT,
  hand TEXT CHECK (hand IN ('L','R') OR hand IS NULL),
  photo_path TEXT,
  note TEXT,
  vnl_2026 BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS player_season_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  source TEXT,
  source_url TEXT,
  note TEXT,
  matches INT,
  sets INT,
  points INT,
  avg_points NUMERIC,
  attack_points INT,
  attack_attempts INT,
  attack_success_pct NUMERIC,
  block_points INT,
  serve_points INT,
  digs INT,
  dig_success_pct NUMERIC,
  receptions INT,
  rec_positive_pct NUMERIC,
  avg_blocks NUMERIC,
  avg_aces NUMERIC,
  avg_attack_points NUMERIC,
  UNIQUE (player_id, season)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  competition TEXT,
  league_id TEXT REFERENCES leagues(id),
  league_country TEXT,
  league_country_code TEXT,
  gender TEXT,
  datetime_utc TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('upcoming','live','final')),
  home_team_id TEXT REFERENCES teams(id),
  away_team_id TEXT REFERENCES teams(id),
  home_name TEXT,
  away_name TEXT,
  home_sets INT,
  away_sets INT,
  venue TEXT,
  broadcast TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS match_sets (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  set_no INT NOT NULL,
  home_points INT NOT NULL,
  away_points INT NOT NULL,
  PRIMARY KEY (match_id, set_no)
);

CREATE TABLE IF NOT EXISTS match_roster (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id),
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS match_player_stats (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id),
  points INT,
  attacks INT,
  blocks INT,
  serves INT,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS gossip_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  date DATE,
  source TEXT,
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS gossip_players (
  gossip_id TEXT REFERENCES gossip_posts(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id),
  PRIMARY KEY (gossip_id, player_id)
);

CREATE TABLE IF NOT EXISTS gossip_tags (
  gossip_id TEXT REFERENCES gossip_posts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (gossip_id, tag)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id),
  player_name TEXT,
  platform TEXT,
  account TEXT,
  caption TEXT,
  posted_on DATE,
  image_path TEXT,
  post_url TEXT
);

CREATE TABLE IF NOT EXISTS site_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
