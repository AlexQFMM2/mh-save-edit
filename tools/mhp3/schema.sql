PRAGMA foreign_keys=ON;
CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE catalog_items(
 game_id TEXT NOT NULL CHECK(game_id='mhp3'),item_id INTEGER PRIMARY KEY,save_id INTEGER CHECK(save_id IS NULL),dex_id INTEGER CHECK(dex_id IS NULL),
 name_cn TEXT NOT NULL,name_en TEXT NOT NULL,name_jp TEXT NOT NULL,description TEXT NOT NULL,
 rarity INTEGER,max_stack INTEGER,buy_price INTEGER NOT NULL,sell_price INTEGER NOT NULL,icon_path TEXT,is_placeholder INTEGER NOT NULL,
 mapping_status TEXT NOT NULL,category TEXT NOT NULL,quantity_kind TEXT NOT NULL,decoration_json TEXT,aliases_json TEXT NOT NULL);
CREATE TABLE catalog_item_localization(item_id INTEGER PRIMARY KEY REFERENCES catalog_items(item_id),original_name TEXT NOT NULL,name_source TEXT NOT NULL,name_status TEXT NOT NULL,
 description_jp TEXT NOT NULL,description_source TEXT NOT NULL,description_status TEXT NOT NULL);
CREATE TABLE p3_combinations(recipe_index INTEGER PRIMARY KEY,display_order INTEGER NOT NULL UNIQUE,
 first_id INTEGER NOT NULL REFERENCES catalog_items(item_id),other_id INTEGER NOT NULL REFERENCES catalog_items(item_id),output_id INTEGER NOT NULL REFERENCES catalog_items(item_id),
 chance INTEGER NOT NULL,minimum INTEGER NOT NULL,maximum INTEGER NOT NULL,weights TEXT NOT NULL);
CREATE TABLE p3_forge_recipes(recipe_index INTEGER PRIMARY KEY,output_id INTEGER NOT NULL REFERENCES catalog_items(item_id));
CREATE TABLE p3_forge_materials(recipe_index INTEGER NOT NULL REFERENCES p3_forge_recipes(recipe_index),position INTEGER NOT NULL,item_id INTEGER NOT NULL REFERENCES catalog_items(item_id),quantity INTEGER NOT NULL CHECK(quantity>0),PRIMARY KEY(recipe_index,position));
CREATE TABLE p3_shops(list_key TEXT NOT NULL,item_id INTEGER NOT NULL REFERENCES catalog_items(item_id),label TEXT NOT NULL,rotation INTEGER,price INTEGER NOT NULL,half_price INTEGER NOT NULL CHECK(half_price IN (0,1)),PRIMARY KEY(list_key,item_id));
CREATE INDEX p3_forge_material_items ON p3_forge_materials(item_id);
CREATE INDEX p3_shop_items ON p3_shops(item_id);
