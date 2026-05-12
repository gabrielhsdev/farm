const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { obrigatorio, numeroPositivo, inteiroPositivo } = require('../utils/validacao');
const { httpError } = require('../middleware/error');

const router = express.Router();

// ----------------------- helpers -----------------------

function buscarAgricultorAtivo(id) {
  return db.prepare(`
    SELECT id FROM usuarios WHERE id = ? AND role='agricultor' AND deleted_at IS NULL
  `).get(id);
}

function buscarOuCriarCarrinhoAtivo(clienteId, agricultorId) {
  let c = db.prepare(`
    SELECT * FROM carrinhos WHERE cliente_id = ? AND agricultor_id = ? AND status = 'ativo'
  `).get(clienteId, agricultorId);
  if (!c) {
    const info = db.prepare(`
      INSERT INTO carrinhos (cliente_id, agricultor_id, status) VALUES (?, ?, 'ativo')
    `).run(clienteId, agricultorId);
    c = db.prepare(`SELECT * FROM carrinhos WHERE id = ?`).get(info.lastInsertRowid);
  }
  return c;
}

function montarCarrinhoResposta(carrinhoId, agricultorId) {
  const itens = db.prepare(`
    SELECT
      ic.id, ic.produto_id, ic.quantidade, ic.preco_unit,
      p.nome,
      (ic.quantidade * ic.preco_unit) AS subtotal
    FROM itens_carrinho ic
    JOIN produtos p ON p.id = ic.produto_id
    WHERE ic.carrinho_id = ?
    ORDER BY ic.id ASC
  `).all(carrinhoId);

  const total = itens.reduce((s, i) => s + i.subtotal, 0);

  const c = db.prepare(`SELECT id, status FROM carrinhos WHERE id = ?`).get(carrinhoId);

  return {
    id: c.id,
    agricultor_id: agricultorId,
    status: c.status,
    itens,
    total: Number(total.toFixed(2))
  };
}

// ----------------------- rotas -----------------------

// GET /api/carrinho/:agricultorId — RF07
router.get('/:agricultorId', requireAuth, requireRole('cliente'), (req, res, next) => {
  try {
    const agricultorId = parseInt(req.params.agricultorId, 10);
    if (!buscarAgricultorAtivo(agricultorId)) {
      throw httpError(404, 'NOT_FOUND', 'Agricultor não encontrado');
    }

    const c = db.prepare(`
      SELECT id FROM carrinhos
      WHERE cliente_id = ? AND agricultor_id = ? AND status='ativo'
    `).get(req.user.id, agricultorId);

    if (!c) {
      // Carrinho vazio sem persistir
      return res.json({
        id: null,
        agricultor_id: agricultorId,
        status: 'ativo',
        itens: [],
        total: 0
      });
    }
    res.json(montarCarrinhoResposta(c.id, agricultorId));
  } catch (err) { next(err); }
});

// POST /api/carrinho/:agricultorId/itens — RF07
router.post('/:agricultorId/itens', requireAuth, requireRole('cliente'), (req, res, next) => {
  try {
    const agricultorId = parseInt(req.params.agricultorId, 10);
    if (!buscarAgricultorAtivo(agricultorId)) {
      throw httpError(404, 'NOT_FOUND', 'Agricultor não encontrado');
    }
    obrigatorio(req.body || {}, ['produto_id', 'quantidade']);
    const produto_id = inteiroPositivo(req.body.produto_id, 'produto_id');
    const quantidade = numeroPositivo(req.body.quantidade, 'quantidade');

    const prod = db.prepare(`
      SELECT * FROM produtos WHERE id = ? AND deleted_at IS NULL
    `).get(produto_id);
    if (!prod) throw httpError(404, 'NOT_FOUND', 'Produto não encontrado');
    if (prod.agricultor_id !== agricultorId) {
      throw httpError(400, 'VALIDATION', 'Produto não pertence a este agricultor');
    }

    const tx = db.transaction(() => {
      const carrinho = buscarOuCriarCarrinhoAtivo(req.user.id, agricultorId);
      const existente = db.prepare(`
        SELECT id, quantidade FROM itens_carrinho WHERE carrinho_id = ? AND produto_id = ?
      `).get(carrinho.id, produto_id);

      if (existente) {
        db.prepare(`
          UPDATE itens_carrinho SET quantidade = quantidade + ?, preco_unit = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(quantidade, prod.preco, existente.id);
      } else {
        db.prepare(`
          INSERT INTO itens_carrinho (carrinho_id, produto_id, quantidade, preco_unit)
          VALUES (?, ?, ?, ?)
        `).run(carrinho.id, produto_id, quantidade, prod.preco);
      }
      return carrinho.id;
    });
    const carrinhoId = tx();

    res.json(montarCarrinhoResposta(carrinhoId, agricultorId));
  } catch (err) { next(err); }
});

// PATCH /api/carrinho/:agricultorId/itens/:itemId — RF07
router.patch('/:agricultorId/itens/:itemId', requireAuth, requireRole('cliente'), (req, res, next) => {
  try {
    const agricultorId = parseInt(req.params.agricultorId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    obrigatorio(req.body || {}, ['quantidade']);
    const quantidade = numeroPositivo(req.body.quantidade, 'quantidade');

    const item = db.prepare(`
      SELECT ic.*, c.cliente_id, c.agricultor_id, c.status
      FROM itens_carrinho ic
      JOIN carrinhos c ON c.id = ic.carrinho_id
      WHERE ic.id = ?
    `).get(itemId);

    if (!item) throw httpError(404, 'NOT_FOUND', 'Item não encontrado');
    if (item.cliente_id !== req.user.id || item.agricultor_id !== agricultorId) {
      throw httpError(403, 'FORBIDDEN', 'Item não pertence ao seu carrinho com este agricultor');
    }
    if (item.status !== 'ativo') {
      throw httpError(400, 'VALIDATION', 'Carrinho não está ativo');
    }

    db.prepare(`UPDATE itens_carrinho SET quantidade = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(quantidade, itemId);

    res.json(montarCarrinhoResposta(item.carrinho_id, agricultorId));
  } catch (err) { next(err); }
});

// DELETE /api/carrinho/:agricultorId/itens/:itemId — RF07
router.delete('/:agricultorId/itens/:itemId', requireAuth, requireRole('cliente'), (req, res, next) => {
  try {
    const agricultorId = parseInt(req.params.agricultorId, 10);
    const itemId = parseInt(req.params.itemId, 10);

    const item = db.prepare(`
      SELECT ic.id, ic.carrinho_id, c.cliente_id, c.agricultor_id, c.status
      FROM itens_carrinho ic
      JOIN carrinhos c ON c.id = ic.carrinho_id
      WHERE ic.id = ?
    `).get(itemId);

    if (!item) throw httpError(404, 'NOT_FOUND', 'Item não encontrado');
    if (item.cliente_id !== req.user.id || item.agricultor_id !== agricultorId) {
      throw httpError(403, 'FORBIDDEN', 'Item não pertence ao seu carrinho com este agricultor');
    }

    db.prepare(`DELETE FROM itens_carrinho WHERE id = ?`).run(itemId);
    res.json(montarCarrinhoResposta(item.carrinho_id, agricultorId));
  } catch (err) { next(err); }
});

// DELETE /api/carrinho/:agricultorId — RF07 (limpa itens)
router.delete('/:agricultorId', requireAuth, requireRole('cliente'), (req, res, next) => {
  try {
    const agricultorId = parseInt(req.params.agricultorId, 10);
    const c = db.prepare(`
      SELECT id FROM carrinhos
      WHERE cliente_id = ? AND agricultor_id = ? AND status='ativo'
    `).get(req.user.id, agricultorId);
    if (!c) throw httpError(404, 'NOT_FOUND', 'Carrinho ativo não encontrado');

    db.prepare(`DELETE FROM itens_carrinho WHERE carrinho_id = ?`).run(c.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
