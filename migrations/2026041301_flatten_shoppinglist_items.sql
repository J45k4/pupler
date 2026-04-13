ALTER TABLE shopping_list_items RENAME TO shopping_list_items_old;

CREATE TABLE shopping_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  done INTEGER NOT NULL,
  source_recipe_id INTEGER REFERENCES recipes(id),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO shopping_list_items (
  id,
  product_id,
  quantity,
  unit,
  done,
  source_recipe_id,
  notes,
  created_at,
  updated_at
)
SELECT
  id,
  product_id,
  quantity,
  unit,
  done,
  source_recipe_id,
  notes,
  created_at,
  updated_at
FROM shopping_list_items_old;

DROP TABLE shopping_list_items_old;
DROP TABLE shopping_lists;

DROP INDEX IF EXISTS idx_shopping_list_items_list_id;
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_product_id ON shopping_list_items(product_id);
