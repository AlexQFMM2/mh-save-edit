CREATE TABLE p3_monsters (
  monster_id INTEGER PRIMARY KEY CHECK(monster_id BETWEEN 1 AND 74),
  record_scope TEXT NOT NULL CHECK(record_scope IN ('normal','extended')),
  book_index INTEGER UNIQUE CHECK(book_index BETWEEN 0 AND 59),
  detail_json TEXT NOT NULL CHECK(json_valid(detail_json)),
  CHECK((record_scope='normal' AND book_index IS NOT NULL) OR (record_scope='extended' AND book_index IS NULL))
);
CREATE TABLE p3_monster_drops (
  id INTEGER PRIMARY KEY,
  monster_id INTEGER NOT NULL REFERENCES p3_monsters(monster_id),
  item_id INTEGER NOT NULL REFERENCES catalog_items(item_id) CHECK(item_id>0),
  source_key TEXT NOT NULL UNIQUE,
  rank_id INTEGER NOT NULL,
  method_id INTEGER NOT NULL,
  quantity INTEGER CHECK(quantity>0),
  probability REAL CHECK(probability BETWEEN 0 AND 100),
  detail_json TEXT NOT NULL CHECK(json_valid(detail_json))
);
CREATE INDEX p3_monster_drop_monster ON p3_monster_drops(monster_id);
CREATE INDEX p3_monster_drop_item ON p3_monster_drops(item_id);
