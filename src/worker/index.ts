import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import {
  authMiddleware,
  deleteSession,
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import type { MochaUser } from "@getmocha/users-service/shared";

type Bindings = {
  DB: D1Database;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

// Auth routes
app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "Código de autorização não fornecido" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60,
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  
  // Buscar ou criar usuário no banco local
  let usuario = await c.env.DB.prepare(
    "SELECT * FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    // Criar usuário no banco local
    const nome = mochaUser.google_user_data.name || mochaUser.email.split('@')[0];
    await c.env.DB.prepare(
      `INSERT INTO usuarios (nome, email, role, limite_diario_mg, timezone, created_at, updated_at)
       VALUES (?, ?, 'user', 500.00, 'America/Sao_Paulo', datetime('now'), datetime('now'))`
    ).bind(nome, mochaUser.email).run();

    usuario = await c.env.DB.prepare(
      "SELECT * FROM usuarios WHERE email = ?"
    ).bind(mochaUser.email).first();
  }

  return c.json({ ...mochaUser, usuario });
});

app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// Usuário routes
app.get("/api/usuarios/perfil", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const usuario = await c.env.DB.prepare(
    "SELECT * FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  return c.json(usuario);
});

app.put("/api/usuarios/perfil", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const body = await c.req.json();

  await c.env.DB.prepare(
    `UPDATE usuarios 
     SET nome = ?, limite_diario_mg = ?, updated_at = datetime('now')
     WHERE email = ?`
  ).bind(body.nome, body.limite_diario_mg, mochaUser.email).run();

  return c.json({ success: true });
});

app.post("/api/usuarios/consentimento-lgpd", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;

  await c.env.DB.prepare(
    `UPDATE usuarios 
     SET consentimento_lgpd_em = datetime('now'), updated_at = datetime('now')
     WHERE email = ?`
  ).bind(mochaUser.email).run();

  return c.json({ success: true });
});

// Referências routes
app.get("/api/referencias", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const search = c.req.query("search") || "";

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM referencias 
     WHERE (is_global = 1 OR criado_por = ?) 
       AND nome LIKE ?
     ORDER BY is_global DESC, nome ASC
     LIMIT 50`
  ).bind(usuario.id, `%${search}%`).all();

  return c.json(results);
});

app.post("/api/referencias", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const body = await c.req.json();

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO referencias (nome, fenil_mg_por_100g, criado_por, is_global, created_at, updated_at)
     VALUES (?, ?, ?, 0, datetime('now'), datetime('now'))`
  ).bind(body.nome, body.fenil_mg_por_100g, usuario.id).run();

  return c.json({ id: result.meta.last_row_id, success: true });
});

app.delete("/api/referencias/:id", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const id = c.req.param("id");

  const usuario = await c.env.DB.prepare(
    "SELECT id, role FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Apenas criador ou admin pode deletar
  const referencia = await c.env.DB.prepare(
    "SELECT criado_por FROM referencias WHERE id = ?"
  ).bind(id).first();

  if (!referencia) {
    return c.json({ error: "Referência não encontrada" }, 404);
  }

  if (usuario.role !== 'admin' && referencia.criado_por !== usuario.id) {
    return c.json({ error: "Sem permissão para deletar esta referência" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM referencias WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// Registros routes
app.get("/api/registros", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const dataInicio = c.req.query("data_inicio");
  const dataFim = c.req.query("data_fim");

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  let query = `
    SELECT r.*, ref.nome as referencia_nome 
    FROM registros r
    JOIN referencias ref ON r.referencia_id = ref.id
    WHERE r.usuario_id = ?
  `;
  const params: any[] = [usuario.id];

  if (dataInicio) {
    query += " AND r.data >= ?";
    params.push(dataInicio);
  }

  if (dataFim) {
    query += " AND r.data <= ?";
    params.push(dataFim);
  }

  query += " ORDER BY r.data DESC, r.created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  return c.json(results);
});

app.post("/api/registros", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const body = await c.req.json();

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Buscar fenilalanina por 100g da referência
  const referencia = await c.env.DB.prepare(
    "SELECT fenil_mg_por_100g FROM referencias WHERE id = ?"
  ).bind(body.referencia_id).first();

  if (!referencia) {
    return c.json({ error: "Referência não encontrada" }, 404);
  }

  // Calcular fenilalanina total
  const fenilMg = (Number(referencia.fenil_mg_por_100g) * Number(body.peso_g)) / 100;

  const result = await c.env.DB.prepare(
    `INSERT INTO registros (data, usuario_id, referencia_id, peso_g, fenil_mg, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(body.data, usuario.id, body.referencia_id, body.peso_g, fenilMg).run();

  return c.json({ id: result.meta.last_row_id, fenil_mg: fenilMg, success: true });
});

app.delete("/api/registros/:id", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const id = c.req.param("id");

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Verificar se o registro pertence ao usuário
  const registro = await c.env.DB.prepare(
    "SELECT usuario_id FROM registros WHERE id = ?"
  ).bind(id).first();

  if (!registro) {
    return c.json({ error: "Registro não encontrado" }, 404);
  }

  if (registro.usuario_id !== usuario.id) {
    return c.json({ error: "Sem permissão para deletar este registro" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM registros WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// Dashboard routes
app.get("/api/dashboard/hoje", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const hoje = new Date().toISOString().split('T')[0];

  const usuario = await c.env.DB.prepare(
    "SELECT id, limite_diario_mg FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const total = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(fenil_mg), 0) as total
     FROM registros
     WHERE usuario_id = ? AND data = ?`
  ).bind(usuario.id, hoje).first();

  return c.json({
    total: total?.total || 0,
    limite: usuario.limite_diario_mg,
    data: hoje,
  });
});

app.get("/api/dashboard/ultimos-dias", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const dias = parseInt(c.req.query("dias") || "7");

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT data, SUM(fenil_mg) as total
     FROM registros
     WHERE usuario_id = ? AND data >= date('now', '-${dias} days')
     GROUP BY data
     ORDER BY data ASC`
  ).bind(usuario.id).all();

  return c.json(results);
});

// Exportação routes
app.get("/api/exportar/csv", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const dataInicio = c.req.query("data_inicio");
  const dataFim = c.req.query("data_fim");

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  let query = `
    SELECT r.data, r.peso_g, r.fenil_mg, ref.nome as alimento
    FROM registros r
    JOIN referencias ref ON r.referencia_id = ref.id
    WHERE r.usuario_id = ?
  `;
  const params: any[] = [usuario.id];

  if (dataInicio) {
    query += " AND r.data >= ?";
    params.push(dataInicio);
  }

  if (dataFim) {
    query += " AND r.data <= ?";
    params.push(dataFim);
  }

  query += " ORDER BY r.data DESC, r.created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // Gerar CSV
  let csv = "Data,Alimento,Peso (g),Fenilalanina (mg)\n";
  for (const row of results) {
    csv += `${row.data},"${row.alimento}",${row.peso_g},${row.fenil_mg}\n`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="meufenil-${dataInicio || 'inicio'}-${dataFim || 'fim'}.csv"`,
    },
  });
});

app.get("/api/exportar/json", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const dataInicio = c.req.query("data_inicio");
  const dataFim = c.req.query("data_fim");

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  let query = `
    SELECT r.*, ref.nome as referencia_nome
    FROM registros r
    JOIN referencias ref ON r.referencia_id = ref.id
    WHERE r.usuario_id = ?
  `;
  const params: any[] = [usuario.id];

  if (dataInicio) {
    query += " AND r.data >= ?";
    params.push(dataInicio);
  }

  if (dataFim) {
    query += " AND r.data <= ?";
    params.push(dataFim);
  }

  query += " ORDER BY r.data DESC, r.created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  return new Response(JSON.stringify(results, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="meufenil-${dataInicio || 'inicio'}-${dataFim || 'fim'}.json"`,
    },
  });
});

// Admin routes
app.get("/api/admin/usuarios", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;

  const usuario = await c.env.DB.prepare(
    "SELECT role FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario || usuario.role !== 'admin') {
    return c.json({ error: "Sem permissão de administrador" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT id, nome, email, role, limite_diario_mg, created_at FROM usuarios ORDER BY created_at DESC"
  ).all();

  return c.json(results);
});

app.put("/api/admin/usuarios/:id/role", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const id = c.req.param("id");
  const body = await c.req.json();

  const usuario = await c.env.DB.prepare(
    "SELECT role FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario || usuario.role !== 'admin') {
    return c.json({ error: "Sem permissão de administrador" }, 403);
  }

  await c.env.DB.prepare(
    "UPDATE usuarios SET role = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(body.role, id).run();

  return c.json({ success: true });
});

app.post("/api/admin/referencias/importar-csv", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const body = await c.req.json();

  const usuario = await c.env.DB.prepare(
    "SELECT id, role FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario || usuario.role !== 'admin') {
    return c.json({ error: "Sem permissão de administrador" }, 403);
  }

  if (!body.csv || typeof body.csv !== 'string') {
    return c.json({ error: "CSV não fornecido" }, 400);
  }

  const lines = body.csv.trim().split('\n');
  let importados = 0;
  let erros: string[] = [];

  // Pular cabeçalho se existir
  const startIndex = lines[0].toLowerCase().includes('nome') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map((p: string) => p.trim().replace(/^["']|["']$/g, ''));
    
    if (parts.length < 2) {
      erros.push(`Linha ${i + 1}: Formato inválido`);
      continue;
    }

    const nome = parts[0];
    const fenilStr = parts[1];
    const fenilMg = parseFloat(fenilStr);

    if (!nome || isNaN(fenilMg) || fenilMg < 0) {
      erros.push(`Linha ${i + 1}: Dados inválidos (${nome}, ${fenilStr})`);
      continue;
    }

    try {
      // Verificar se já existe
      const existente = await c.env.DB.prepare(
        "SELECT id FROM referencias WHERE nome = ? AND is_global = 1"
      ).bind(nome).first();

      if (existente) {
        // Atualizar se já existe
        await c.env.DB.prepare(
          `UPDATE referencias 
           SET fenil_mg_por_100g = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).bind(fenilMg, existente.id).run();
      } else {
        // Inserir novo
        await c.env.DB.prepare(
          `INSERT INTO referencias (nome, fenil_mg_por_100g, criado_por, is_global, created_at, updated_at)
           VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`
        ).bind(nome, fenilMg, usuario.id).run();
      }

      importados++;
    } catch (error) {
      erros.push(`Linha ${i + 1}: Erro ao salvar ${nome}`);
    }
  }

  return c.json({
    success: true,
    importados,
    erros,
    total: lines.length - startIndex,
  });
});

app.get("/api/admin/referencias/modelo-csv", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;

  const usuario = await c.env.DB.prepare(
    "SELECT role FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario || usuario.role !== 'admin') {
    return c.json({ error: "Sem permissão de administrador" }, 403);
  }

  const csv = `nome,fenil_mg_por_100g
Arroz branco cozido,80
Feijão preto cozido,140
Peito de frango,850
Ovo inteiro,690
Leite integral,160`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-referencias.csv"',
    },
  });
});

// Exames PKU routes
app.get("/api/exames-pku", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM exames_pku 
     WHERE usuario_id = ?
     ORDER BY data_exame DESC`
  ).bind(usuario.id).all();

  return c.json(results);
});

app.post("/api/exames-pku", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const body = await c.req.json();

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO exames_pku (usuario_id, data_exame, resultado_mg_dl, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(usuario.id, body.data_exame, body.resultado_mg_dl).run();

  return c.json({ id: result.meta.last_row_id, success: true });
});

app.delete("/api/exames-pku/:id", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;
  const id = c.req.param("id");

  const usuario = await c.env.DB.prepare(
    "SELECT id FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Verificar se o exame pertence ao usuário
  const exame = await c.env.DB.prepare(
    "SELECT usuario_id FROM exames_pku WHERE id = ?"
  ).bind(id).first();

  if (!exame) {
    return c.json({ error: "Exame não encontrado" }, 404);
  }

  if (exame.usuario_id !== usuario.id) {
    return c.json({ error: "Sem permissão para deletar este exame" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM exames_pku WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

app.get("/api/admin/estatisticas-db", authMiddleware, async (c) => {
  const mochaUser = c.get("user") as MochaUser;

  const usuario = await c.env.DB.prepare(
    "SELECT role FROM usuarios WHERE email = ?"
  ).bind(mochaUser.email).first();

  if (!usuario || usuario.role !== 'admin') {
    return c.json({ error: "Sem permissão de administrador" }, 403);
  }

  // Contar linhas em cada tabela
  const totalUsuarios = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM usuarios"
  ).first();

  const totalReferencias = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM referencias"
  ).first();

  const totalRegistros = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM registros"
  ).first();

  // Contar referências globais vs personalizadas
  const referenciasGlobais = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM referencias WHERE is_global = 1"
  ).first();

  const referenciasPersonalizadas = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM referencias WHERE is_global = 0"
  ).first();

  // Estimativa de tamanho do banco (muito aproximada)
  // Cada linha ocupa aproximadamente:
  // - usuarios: ~150 bytes
  // - referencias: ~100 bytes
  // - registros: ~80 bytes
  const tamanhoEstimadoBytes =
    (Number(totalUsuarios?.count) || 0) * 150 +
    (Number(totalReferencias?.count) || 0) * 100 +
    (Number(totalRegistros?.count) || 0) * 80;

  const tamanhoEstimadoMB = tamanhoEstimadoBytes / (1024 * 1024);
  const limiteGratuitoMB = 500;
  const percentualUsado = (tamanhoEstimadoMB / limiteGratuitoMB) * 100;

  return c.json({
    usuarios: totalUsuarios?.count || 0,
    referencias: {
      total: totalReferencias?.count || 0,
      globais: referenciasGlobais?.count || 0,
      personalizadas: referenciasPersonalizadas?.count || 0,
    },
    registros: totalRegistros?.count || 0,
    armazenamento: {
      estimado_mb: parseFloat(tamanhoEstimadoMB.toFixed(2)),
      limite_gratuito_mb: limiteGratuitoMB,
      percentual_usado: parseFloat(percentualUsado.toFixed(2)),
    },
  });
});

export default app;
