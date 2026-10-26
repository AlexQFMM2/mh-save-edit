PRAGMA foreign_keys=ON;
CREATE TABLE p3_armor_recipes (
 recipe_key TEXT PRIMARY KEY,
 armor_key TEXT NOT NULL REFERENCES p3_skill_armors(armor_key),
 route_order INTEGER NOT NULL CHECK(route_order>=0),
 cost INTEGER CHECK(cost>=0),
 UNIQUE(armor_key,route_order)
);
CREATE TABLE p3_armor_materials (
 recipe_key TEXT NOT NULL REFERENCES p3_armor_recipes(recipe_key),
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 3),
 item_id INTEGER NOT NULL REFERENCES catalog_items(item_id),
 quantity INTEGER NOT NULL CHECK(quantity>0),
 PRIMARY KEY(recipe_key,position)
);
CREATE INDEX p3_armor_material_item ON p3_armor_materials(item_id);
CREATE TABLE p3_armor_sets (set_key TEXT PRIMARY KEY, sort_order INTEGER NOT NULL UNIQUE, detail_json TEXT NOT NULL);
CREATE TABLE p3_armor_members (
 set_key TEXT NOT NULL REFERENCES p3_armor_sets(set_key),
 combat TEXT NOT NULL CHECK(combat IN ('both','blademaster','gunner')),
 part TEXT NOT NULL CHECK(part IN ('head','chest','arms','waist','legs')),
 armor_key TEXT NOT NULL REFERENCES p3_skill_armors(armor_key),
 PRIMARY KEY(set_key,combat,part), UNIQUE(set_key,combat,armor_key)
);
CREATE INDEX p3_armor_member_armor ON p3_armor_members(armor_key);
