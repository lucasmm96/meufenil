
CREATE TABLE registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data DATE NOT NULL,
  usuario_id INTEGER NOT NULL,
  referencia_id INTEGER NOT NULL,
  peso_g REAL NOT NULL,
  fenil_mg REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (referencia_id) REFERENCES referencias(id)
);

CREATE INDEX idx_registros_usuario_data ON registros(usuario_id, data);
CREATE INDEX idx_registros_data ON registros(data);
