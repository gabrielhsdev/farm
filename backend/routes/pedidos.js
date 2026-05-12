const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { obrigatorio, inteiroPositivo, paginacao, emEnum } = require('../utils/validacao');
const { httpError } = require('../middleware/error');

const router = express.Router();

const STATUS_VALIDOS = ['pendente', 'confirmado', 'entregue', 'cancelado'];

// ----------------------- helpers -----------------------

function carregarPedido(id) {
  const p = db.prepare(`
    SELECT
      pe.id, pe.conversa_id, pe.mensagem_snapshot_id,
      pe.cliente_id, pe.agricultor_id,
      pe.status, pe.total, pe.observacoes, pe.data_retirada,
      pe.created_at, pe.updated_at,
      fp.id AS forma_id, fp.nome AS forma_nome
    FROM pedidos pe
    JOIN formas_pagamento fp ON fp.id = pe.forma_pagamento_id
    WHERE pe.id = ?
  `).get(id);
  if (!p) return null;

  const itens = db.prepare(`
    SELECT produto_id, nome_produto, quantidade, preco_unit, subtotal
    FROM itens_pedido WHERE pedido_id = ? ORDER BY id ASC
  `).all(id);

  return {
    id: p.id,
    conversa_id: p.conversa_id,
    mensagem_snapshot_id: p.mensagem_snapshot_id,
    cliente_id: p.cliente_id,
    agricultor_id: p.agricultor_id,
    status: p.status,
    total: p.total,
    forma_pagamento: { id: p.forma_id, nome: p.forma_nome },
    data_retirada: p.data_retirada,
    observacoes: p.observacoes,
    itens,
    created_at: p.created_at,
    updated_at: p.updated_at
  };
}

// ----------------------- rotas -----------------------

// POST /api/pedidos — RF13
router.post('/', requireAuth, requireRole('agricultor'), (req, res, next) => {
  try {
    obrigatorio(req.body || {}, ['mensagem_snapshot_id', 'forma_pagamento_id']);
    const msgId = inteiroPositivo(req.body.mensagem_snapshot_id, 'mensagem_snapshot_id');
    const fpId  = inteiroPositivo(req.body.forma_pagamento_id, 'forma_pagamento_id');

    const msg = db.prepare(`
      SELECT m.*, c.cliente_id, c.agricultor_id
      FROM mensagens m
      JOIN conversas c ON c.id = m.conversa_id
      WHERE m.id = ?
    `).get(msgId);
    if (!msg) throw httpError(404, 'NOT_FOUND', 'Mensagem snapshot não encontrada');
    if (msg.tipo !== 'snapshot') throw httpError(400, 'VALIDATION', 'Mensagem não é do tipo snapshot');
    if (msg.agricultor_id !== req.user.id) {
      throw httpError(403, 'FORBIDDEN', 'Você não é o destinatário desta snapshot');
    }

    const fp = db.prepare(`SELECT id, nome FROM formas_pagamento WHERE id = ?`).get(fpId);
    if (!fp) throw httpError(404, 'NOT_FOUND', 'Forma de pagamento não encontrada');

    const jaUsado = db.prepare(`SELECT id FROM pedidos WHERE mensagem_snapshot_id = ?`).get(msgId);
    if (jaUsado) throw httpError(400, 'SNAPSHOT_USADO', 'Este snapshot já gerou um pedido');

    let payload;
    try { payload = JSON.parse(msg.snapshot_json); }
    catch { throw httpError(400, 'VALIDATION', 'snapshot_json corrompido'); }

    if (!payload || !Array.isArray(payload.itens) || payload.itens.length === 0) {
      throw httpError(400, 'VALIDATION', 'Snapshot sem itens');
    }

    const dataRetirada = req.body.data_retirada || null;
    const observacoes  = req.body.observacoes   || null;

    const tx = db.transaction(() => {
      // Verifica estoque e decrementa
      for (const item of payload.itens) {
        const prod = db.prepare(`SELECT id, estoque, nome FROM produtos WHERE id = ? AND deleted_at IS NULL`)
          .get(item.produto_id);
        if (!prod) throw httpError(400, 'PRODUTO_INDISPONIVEL', `Produto ${item.produto_id} não disponível`);
        if (prod.estoque < item.quantidade) {
          throw httpError(400, 'ESTOQUE_INSUFICIENTE',
            `Estoque insuficiente para "${prod.nome}" (disponível: ${prod.estoque}, pedido: ${item.quantidade})`);
        }
      }

      const total = payload.itens.reduce((s, i) =>
        s + (Number(i.preco_unit) * Number(i.quantidade)), 0);

      const info = db.prepare(`
        INSERT INTO pedidos
          (conversa_id, mensagem_snapshot_id, cliente_id, agricultor_id,
           forma_pagamento_id, status, total, observacoes, data_retirada)
        VALUES (?, ?, ?, ?, ?, 'pendente', ?, ?, ?)
      `).run(msg.conversa_id, msg.id, msg.cliente_id, msg.agricultor_id,
             fpId, total, observacoes, dataRetirada);

      const pedidoId = info.lastInsertRowid;

      const insItem = db.prepare(`
        INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, quantidade, preco_unit, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const decEst = db.prepare(`UPDATE produtos SET estoque = estoque - ? WHERE id = ?`);

      for (const i of payload.itens) {
        const subtotal = Number((i.preco_unit * i.quantidade).toFixed(2));
        insItem.run(pedidoId, i.produto_id, i.nome, i.quantidade, i.preco_unit, subtotal);
        decEst.run(i.quantidade, i.produto_id);
      }
      return pedidoId;
    });

    const id = tx();
    res.status(201).json(carregarPedido(id));
  } catch (err) { next(err); }
});

// GET /api/pedidos — RF13
router.get('/', requireAuth, (req, res, next) => {
  try {
    const { page, limit, offset } = paginacao(req.query);
    const where = [];
    const params = { uid: req.user.id, limit, offset };

    if (req.user.role === 'cliente')    where.push(`pe.cliente_id    = @uid`);
    else                                where.push(`pe.agricultor_id = @uid`);

    if (req.query.status) {
      emEnum(req.query.status, 'status', STATUS_VALIDOS);
      where.push(`pe.status = @status`);
      params.status = req.query.status;
    }

    const whereSQL = `WHERE ${where.join(' AND ')}`;
    const total = db.prepare(`SELECT COUNT(*) AS n FROM pedidos pe ${whereSQL}`).get(params).n;
    const rows  = db.prepare(`
      SELECT pe.id FROM pedidos pe ${whereSQL}
      ORDER BY pe.created_at DESC
      LIMIT @limit OFFSET @offset
    `).all(params);

    const items = rows.map(r => carregarPedido(r.id));
    res.json({ items, page, limit, total });
  } catch (err) { next(err); }
});

// GET /api/pedidos/:id — RF13
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const p = carregarPedido(id);
    if (!p) throw httpError(404, 'NOT_FOUND', 'Pedido não encontrado');
    if (p.cliente_id !== req.user.id && p.agricultor_id !== req.user.id) {
      throw httpError(403, 'FORBIDDEN', 'Você não é parte deste pedido');
    }
    res.json(p);
  } catch (err) { next(err); }
});

// PATCH /api/pedidos/:id/status — RF13
router.patch('/:id/status', requireAuth, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    obrigatorio(req.body || {}, ['status']);
    const novoStatus = req.body.status;
    emEnum(novoStatus, 'status', STATUS_VALIDOS);

    const p = db.prepare(`SELECT * FROM pedidos WHERE id = ?`).get(id);
    if (!p) throw httpError(404, 'NOT_FOUND', 'Pedido não encontrado');

    const isCliente    = p.cliente_id    === req.user.id && req.user.role === 'cliente';
    const isAgricultor = p.agricultor_id === req.user.id && req.user.role === 'agricultor';
    if (!isCliente && !isAgricultor) {
      throw httpError(403, 'FORBIDDEN', 'Você não é parte deste pedido');
    }

    // Regras de transição:
    //   Agricultor: pendente→confirmado, confirmado→entregue, qualquer→cancelado
    //   Cliente:    pendente→cancelado
    const atual = p.status;
    let permitido = false;

    if (isAgricultor) {
      if (atual === 'pendente'    && novoStatus === 'confirmado') permitido = true;
      if (atual === 'confirmado'  && novoStatus === 'entregue')   permitido = true;
      if (novoStatus === 'cancelado' && atual !== 'cancelado' && atual !== 'entregue') permitido = true;
    }
    if (isCliente) {
      if (atual === 'pendente' && novoStatus === 'cancelado') permitido = true;
    }
    if (atual === novoStatus) {
      throw httpError(400, 'TRANSICAO_INVALIDA', 'Pedido já está neste status');
    }
    if (!permitido) {
      throw httpError(403, 'TRANSICAO_INVALIDA',
        `Transição ${atual} → ${novoStatus} não permitida para ${req.user.role}`);
    }

    db.prepare(`UPDATE pedidos SET status = ? WHERE id = ?`).run(novoStatus, id);
    res.json(carregarPedido(id));
  } catch (err) { next(err); }
});

module.exports = router;
