CREATE TABLE p3_charm_generation_sources (
  source_key TEXT PRIMARY KEY,
  item_id INTEGER NOT NULL CHECK(item_id BETWEEN 1 AND 65535),
  label_jp TEXT NOT NULL,
  skill1_pool TEXT NOT NULL,
  skill2_pool TEXT,
  second_skill_threshold INTEGER NOT NULL CHECK(second_skill_threshold BETWEEN 0 AND 100),
  slot_table_key TEXT NOT NULL,
  evidence TEXT NOT NULL
);

CREATE TABLE p3_charm_slot_tables (
  source_key TEXT NOT NULL REFERENCES p3_charm_generation_sources(source_key),
  rank INTEGER NOT NULL CHECK(rank BETWEEN 0 AND 20),
  slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 3),
  cumulative INTEGER NOT NULL CHECK(cumulative BETWEEN 0 AND 100),
  width INTEGER NOT NULL CHECK(width BETWEEN 0 AND 100),
  PRIMARY KEY(source_key, rank, slot)
);

CREATE TABLE p3_charm_grade_rules (
  source_key TEXT NOT NULL REFERENCES p3_charm_generation_sources(source_key),
  grade INTEGER NOT NULL CHECK(grade BETWEEN 0 AND 6),
  min_f INTEGER NOT NULL CHECK(min_f BETWEEN 0 AND 26),
  max_f INTEGER NOT NULL CHECK(max_f BETWEEN 0 AND 26),
  name_cn TEXT NOT NULL,
  name_jp TEXT NOT NULL,
  PRIMARY KEY(source_key, grade),
  CHECK(min_f <= max_f)
);
