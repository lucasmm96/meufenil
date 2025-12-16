
CREATE TABLE referencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  fenil_mg_por_100g REAL NOT NULL,
  criado_por INTEGER,
  is_global BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

CREATE INDEX idx_referencias_criado_por ON referencias(criado_por);
CREATE INDEX idx_referencias_is_global ON referencias(is_global);
CREATE INDEX idx_referencias_nome ON referencias(nome);
