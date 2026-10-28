CREATE TABLE p3_weapon_types (
  native_type INTEGER PRIMARY KEY, type_id INTEGER NOT NULL UNIQUE, detail_json TEXT NOT NULL CHECK(json_valid(detail_json))
);
CREATE TABLE p3_weapons (
  weapon_key TEXT PRIMARY KEY, native_type INTEGER NOT NULL REFERENCES p3_weapon_types(native_type),
  native_id INTEGER NOT NULL CHECK(native_id>0), detail_json TEXT NOT NULL CHECK(json_valid(detail_json)), UNIQUE(native_type,native_id)
);
CREATE TABLE p3_weapon_recipes (
  recipe_key TEXT PRIMARY KEY, weapon_key TEXT NOT NULL REFERENCES p3_weapons(weapon_key),
  kind TEXT NOT NULL CHECK(kind IN ('production','upgrade','appraisal')), cost INTEGER CHECK(cost>=0), source TEXT NOT NULL
);
CREATE INDEX p3_weapon_recipe_target ON p3_weapon_recipes(weapon_key);
CREATE TABLE p3_weapon_materials (
  recipe_key TEXT NOT NULL REFERENCES p3_weapon_recipes(recipe_key), role TEXT NOT NULL CHECK(role IN ('material','byproduct')),
  position INTEGER NOT NULL CHECK(position>=0), item_id INTEGER NOT NULL REFERENCES catalog_items(item_id), quantity INTEGER CHECK(quantity>0),
  PRIMARY KEY(recipe_key,role,position)
);
CREATE INDEX p3_weapon_material_item ON p3_weapon_materials(item_id);
CREATE TABLE p3_weapon_edges (
  parent_weapon_key TEXT NOT NULL REFERENCES p3_weapons(weapon_key), child_weapon_key TEXT NOT NULL REFERENCES p3_weapons(weapon_key),
  branch_order INTEGER NOT NULL CHECK(branch_order>=0), PRIMARY KEY(parent_weapon_key,child_weapon_key), UNIQUE(parent_weapon_key,branch_order)
);
CREATE INDEX p3_weapon_edge_child ON p3_weapon_edges(child_weapon_key);
CREATE TABLE p3_weapon_item_links (
  weapon_key TEXT NOT NULL REFERENCES p3_weapons(weapon_key), item_id INTEGER NOT NULL REFERENCES catalog_items(item_id),
  role TEXT NOT NULL CHECK(role IN ('boost','ammo','coating')), requires_skill INTEGER NOT NULL CHECK(requires_skill IN (0,1)),
  PRIMARY KEY(weapon_key,item_id,role)
);
CREATE INDEX p3_weapon_link_item ON p3_weapon_item_links(item_id);
