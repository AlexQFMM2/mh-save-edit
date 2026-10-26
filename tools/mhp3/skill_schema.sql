PRAGMA foreign_keys=ON;
CREATE TABLE p3_skills (skill_id INTEGER PRIMARY KEY, detail_json TEXT NOT NULL);
CREATE TABLE p3_skill_armors (armor_key TEXT PRIMARY KEY, detail_json TEXT NOT NULL);
CREATE TABLE p3_armor_skill_points (
 armor_key TEXT NOT NULL REFERENCES p3_skill_armors(armor_key),
 skill_id INTEGER NOT NULL REFERENCES p3_skills(skill_id), points INTEGER NOT NULL CHECK(points<>0),
 kind TEXT NOT NULL CHECK(kind IN ('signed-points','torso-copy-marker')),
 PRIMARY KEY(armor_key,skill_id)
);
CREATE TABLE p3_skill_charm_sources (
 source_key TEXT PRIMARY KEY, skill_id INTEGER NOT NULL REFERENCES p3_skills(skill_id), detail_json TEXT NOT NULL
);
