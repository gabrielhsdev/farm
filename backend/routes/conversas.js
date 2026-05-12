const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { obrigatorio } = require('../utils/validacao');
const { httpError } = require('../middleware/error');

const router = express.Router();

// ----------------------- helpers -----------------------

function getOuCriarConversa(clienteId, agricultorId) {
  let c = db.prepare(`
    SELECT * FROM conversas WHERE cliente_id = ? AND agricultor_id = ?
  `).get(clienteId, agricultorId);
  if (!c) {
    const info = db.prepare(`INSERT INTO conversas (cliente_id, agricultor_id) VALUES (?, ?)`)
      .run(clienteId, agricultorId);
    c = db.prepare(`SELECT * FROM conversas WHERE id = ?`).get(info.lastInsertRowid);
  }
  return c;
}

function ehParticipanteDe(usuarioId, conversa) {
  return conversa && (conversa.cliente_id === usuarioId || conversa.agricultor_id === usuarioId);
}

function serializarMensagem(m) {
  return {
    id: m.id,
    conversa_id: m.conversa_id,
    remetente_id: m.remetente_id,
    tipo: m.tipo,
    conteudo: m.conteudo,
    snapshot_json: m.snapshot_json ? JSON.parse(m.snapshot_json) : null,
    carrinho_id: m.carrinho_id,
    created_at: m.created_at
  };
}

// ----------------------- rotas -----------------------

// GET /api/conversas — RF08, RF12
router.get('/', requireAuth, (req, res, next) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    // Lista conversas onde o usuário aparece como cliente ou agricultor.
    const rows = db.prepare(`
      SELECT
        co.id,
        co.cliente_id, co.agricultor_id,
        uc.nome AS cliente_nome,
        ua.nome AS agricultor_nome,
        (SELECT m.tipo       FROM mensagens m WHERE m.conversa_id = co.id ORDER BY m.created_at DESC LIMIT 1) AS ult_tipo,
        (SELECT m.conteudo   FROM mensagens m WHERE m.conversa_id = co.id ORDER BY m.created_at DESC LIMIT 1) AS ult_conteudo,
        (SELECT m.created_at FROM mensagens m WHERE m.conversa_id = co.id ORDER BY m.created_at DESC LIMIT 1) AS ult_created
      FROM conversas co
      JOIN usuarios uc ON uc.id = co.cliente_id
      JOIN usuarios ua ON ua.id = co.agricultor_id
      WHERE co.cliente_id = @uid OR co.agricultor_id = @uid
      ORDER BY ult_created DESC NULLS LAST, co.updated_at DESC
    `).all({ uid: userId });

    const items = rows.map(r => {
      const sourole = role === 'cliente' ? 'cliente' : 'agricultor';
      const outro = sourole === 'cliente'
        ? { id: r.agricultor_id, nome: r.agricultor_nome, role: 'agricultor' }
        : { id: r.cliente_id,    nome: r.cliente_nome,    role: 'cliente' };

      let preview = null;
      if (r.ult_tipo === 'texto') preview = r.ult_conteudo;
      else if (r.ult_tipo === 'snapshot') preview = '[snapshot do carrinho]';

      return {
        id: r.id,
        outro,
        ultima_mensagem: r.ult_tipo ? {
          tipo: r.ult_tipo,
          preview,
          created_at: r.ult_created
        } : null
      };
    });

    res.json(items);
  } catch (err) { next(err); }
});

// GET /api/conversas/:id/mensagens — RF08 (suporta polling com ?desde=ISO)
router.get('/:id/mensagens', requireAuth, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const conv = db.prepare(`SELECT * FROM conversas WHERE id = ?`).get(id);
    if (!conv) throw httpError(404, 'NOT_FOUND', 'Conversa não encontrada');
    if (!ehParticipanteDe(req.user.id, conv)) {
      throw httpError(403, 'FORBIDDEN', 'Você não participa desta conversa');
    }

    // Aceita 'desde' (português, do prompt) ou 'since' (do API.md) como sinônimos
    const cursor = req.query.desde || req.query.since;
    let limit = parseInt(req.query.limit, 10) || 50;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    let rows;
    if (cursor) {
      // Validação básica do ISO timestamp
      const t = Date.parse(cursor);
      if (Number.isNaN(t)) throw httpError(400, 'VALIDATION', '`desde` mal formatado (esperado ISO 8601)');
      rows = db.prepare(`
        SELECT * FROM mensagens
        WHERE conversa_id = ? AND created_at > ?
        ORDER BY created_at ASC
      `).all(id, cursor);
    } else {
      // Últimas N, em ordem cronológica
      rows = db.prepare(`
        SELECT * FROM (
          SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY created_at DESC LIMIT ?
        ) ORDER BY created_at ASC
      `).all(id, limit);
    }

    const mensagens = rows.map(serializarMensagem);
    const server_time = new Date().toISOString();
    res.json({ mensagens, server_time });
  } catch (err) { next(err); }
});

// POST /api/conversas/com/:outroId/mensagens — RF08, RF12
router.post('/com/:outroId/mensagens', requireAuth, (req, res, next) => {
  try {
    const outroId = parseInt(req.params.outroId, 10);
    obrigatorio(req.body || {}, ['conteudo']);
    const conteudo = String(req.body.conteudo).trim();
    if (!conteudo) throw httpError(400, 'VALIDATION', 'conteudo vazio');

    const outro = db.prepare(`
      SELECT id, role FROM usuarios WHERE id = ? AND deleted_at IS NULL
    `).get(outroId);
    if (!outro) throw httpError(404, 'NOT_FOUND', 'Usuário destinatário não encontrado');

    if (outro.role === req.user.role) {
      throw httpError(403, 'FORBIDDEN', 'Conversa requer um cliente e um agricultor');
    }

    // Determina cliente_id e agricultor_id corretos
    const clienteId    = req.user.role === 'cliente'    ? req.user.id : outro.id;
    const agricultorId = req.user.role === 'agricultor' ? req.user.id : outro.id;

    const tx = db.transaction(() => {
      const conv = getOuCriarConversa(clienteId, agricultorId);
      const info = db.prepare(`
        INSERT INTO mensagens (conversa_id, remetente_id, tipo, conteudo)
        VALUES (?, ?, 'texto', ?)
      `).run(conv.id, req.user.id, conteudo);
      // bump da conversa
      db.prepare(`UPDATE conversas SET updated_at = datetime('now') WHERE id = ?`).run(conv.id);
      const m = db.prepare(`SELECT * FROM mensagens WHERE id = ?`).get(info.lastInsertRowid);
      return { conv, m };
    });
    const { conv, m } = tx();

    res.status(201).json({ conversa_id: conv.id, mensagem: serializarMensagem(m) });
  } catch (err) { next(err); }
});

// POST /api/conversas/com/:agricultorId/snapshot — RF07, RF08
// Decisão (do prompt): NÃO marca o carrinho como 'snapshot_enviado' e NÃO o invalida.
// Apenas serializa o estado atual em uma mensagem do tipo 'snapshot'.
router.post('/com/:agricultorId/snapshot', requireAuth, requireRole('cliente'), (req, res, next) => {
  try {
    const agricultorId = parseInt(req.params.agricultorId, 10);
    const agr = db.prepare(`
      SELECT id FROM usuarios WHERE id = ? AND role='agricultor' AND deleted_at IS NULL
    `).get(agricultorId);
    if (!agr) throw httpError(404, 'NOT_FOUND', 'Agricultor não encontrado');

    const carrinho = db.prepare(`
      SELECT * FROM carrinhos
      WHERE cliente_id = ? AND agricultor_id = ? AND status = 'ativo'
    `).get(req.user.id, agricultorId);
    if (!carrinho) throw httpError(400, 'CARRINHO_VAZIO', 'Não há carrinho ativo');

    const itens = db.prepare(`
      SELECT
        ic.produto_id, ic.quantidade, ic.preco_unit,
        p.nome,
        (ic.quantidade * ic.preco_unit) AS subtotal
      FROM itens_carrinho ic
      JOIN produtos p ON p.id = ic.produto_id
      WHERE ic.carrinho_id = ?
    `).all(carrinho.id);

    if (itens.length === 0) throw httpError(400, 'CARRINHO_VAZIO', 'Carrinho está vazio');

    const total = itens.reduce((s, i) => s + i.subtotal, 0);
    const payload = {
      itens: itens.map(i => ({
        produto_id: i.produto_id,
        nome: i.nome,
        quantidade: i.quantidade,
        preco_unit: i.preco_unit,
        subtotal: Number(i.subtotal.toFixed(2))
      })),
      total: Number(total.toFixed(2))
    };

    const tx = db.transaction(() => {
      const conv = getOuCriarConversa(req.user.id, agricultorId);
      const info = db.prepare(`
        INSERT INTO mensagens (conversa_id, remetente_id, tipo, snapshot_json, carrinho_id)
        VALUES (?, ?, 'snapshot', ?, ?)
      `).run(conv.id, req.user.id, JSON.stringify(payload), carrinho.id);
      db.prepare(`UPDATE conversas SET updated_at = datetime('now') WHERE id = ?`).run(conv.id);
      // NOTA: por decisão do prompt, NÃO alteramos status do carrinho.
      const m = db.prepare(`SELECT * FROM mensagens WHERE id = ?`).get(info.lastInsertRowid);
      return { conv, m };
    });
    const { conv, m } = tx();

    res.status(201).json({ conversa_id: conv.id, mensagem: serializarMensagem(m) });
  } catch (err) { next(err); }
});

module.exports = router;
