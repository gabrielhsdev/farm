const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { obrigatorio, inteiroPositivo, paginacao } = require('../utils/validacao');
const { httpError } = require('../middleware/error');

// Dois routers separados para montagem limpa em server.js:
// - avaliacoes:        POST /api/avaliacoes
// - avaliacoesPorAgr:  GET  /api/agricultores/:id/avaliacoes
const avaliacoes = express.Router();
const avaliacoesPorAgr = express.Router({ mergeParams: true });

// POST /api/avaliacoes — RF11 (upsert por par cliente-agricultor)
avaliacoes.post('/', requireAuth, requireRole('cliente'), (req, res, next) => {
  try {
    obrigatorio(req.body || {}, ['agricultor_id', 'pedido_id', 'nota']);
    const agricultorId = inteiroPositivo(req.body.agricultor_id, 'agricultor_id');
    const pedidoId     = inteiroPositivo(req.body.pedido_id, 'pedido_id');
    const nota         = parseInt(req.body.nota, 10);
    const comentario   = req.body.comentario || null;

    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      throw httpError(400, 'VALIDATION', 'nota deve ser inteiro entre 1 e 5');
    }

    const agr = db.prepare(`
      SELECT id FROM usuarios WHERE id = ? AND role='agricultor' AND deleted_at IS NULL
    `).get(agricultorId);
    if (!agr) throw httpError(404, 'NOT_FOUND', 'Agricultor não encontrado');

    const pedido = db.prepare(`SELECT * FROM pedidos WHERE id = ?`).get(pedidoId);
    if (!pedido) throw httpError(404, 'NOT_FOUND', 'Pedido não encontrado');

    if (pedido.cliente_id !== req.user.id || pedido.agricultor_id !== agricultorId) {
      throw httpError(400, 'VALIDATION', 'Pedido não pertence a este par cliente-agricultor');
    }
    if (pedido.status !== 'entregue') {
      throw httpError(400, 'VALIDATION', 'Só é possível avaliar pedidos entregues');
    }

    db.prepare(`
      INSERT INTO avaliacoes (cliente_id, agricultor_id, pedido_id, nota, comentario)
      VALUES (@cliente_id, @agricultor_id, @pedido_id, @nota, @comentario)
      ON CONFLICT(cliente_id, agricultor_id) DO UPDATE SET
        pedido_id  = excluded.pedido_id,
        nota       = excluded.nota,
        comentario = excluded.comentario,
        updated_at = datetime('now')
    `).run({
      cliente_id: req.user.id,
      agricultor_id: agricultorId,
      pedido_id: pedidoId,
      nota,
      comentario
    });

    const av = db.prepare(`
      SELECT id, cliente_id, agricultor_id, pedido_id, nota, comentario, created_at, updated_at
      FROM avaliacoes WHERE cliente_id = ? AND agricultor_id = ?
    `).get(req.user.id, agricultorId);

    res.json(av);
  } catch (err) { next(err); }
});

// GET /api/agricultores/:id/avaliacoes — RF11
avaliacoesPorAgr.get('/', (req, res, next) => {
  try {
    const agricultorId = parseInt(req.params.id, 10);
    const { page, limit, offset } = paginacao(req.query);

    const agr = db.prepare(`
      SELECT id FROM usuarios WHERE id = ? AND role='agricultor' AND deleted_at IS NULL
    `).get(agricultorId);
    if (!agr) throw httpError(404, 'NOT_FOUND', 'Agricultor não encontrado');

    const total = db.prepare(`
      SELECT COUNT(*) AS n FROM avaliacoes WHERE agricultor_id = ?
    `).get(agricultorId).n;

    const rows = db.prepare(`
      SELECT a.id, a.nota, a.comentario, a.created_at,
             u.id AS cliente_id, u.nome AS cliente_nome
      FROM avaliacoes a
      JOIN usuarios u ON u.id = a.cliente_id
      WHERE a.agricultor_id = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(agricultorId, limit, offset);

    const items = rows.map(r => ({
      id: r.id,
      cliente: { id: r.cliente_id, nome: r.cliente_nome },
      nota: r.nota,
      comentario: r.comentario,
      created_at: r.created_at
    }));

    const resumo = db.prepare(`
      SELECT media_avaliacoes AS media, total_avaliacoes AS total
      FROM perfis_agricultor WHERE usuario_id = ?
    `).get(agricultorId) || { media: 0, total: 0 };

    res.json({ items, page, limit, total, resumo });
  } catch (err) { next(err); }
});

module.exports = { avaliacoes, avaliacoesPorAgr };
