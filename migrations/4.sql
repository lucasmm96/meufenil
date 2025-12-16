
CREATE TABLE exames_pku (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  data_exame DATE NOT NULL,
  resultado_mg_dl REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_exames_pku_usuario_data ON exames_pku(usuario_id, data_exame DESC);
