const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const {
  obrigatorio, numeroNaoNegativo, inteiroPositivo, emEnum, paginacao
} = require('../utils/validacao');
const { httpError } = require('../middleware/error');
const { criarImagemSeNecessario } = require('../utils/imagens');

// Três routers separados:
// - produtos:           /api/produtos (POST, PATCH/:id, DELETE/:id)
// - produtosPorAgr:     /api/agricultores/:id/produtos (GET)
// - imagens:            /api/imagens/:id (GET)
const produtos       = express.Router();
const produtosPorAgr = express.Router({ mergeParams: true });
const imagens        = express.Router();

const UNIDADES = ['un','kg','g','L','mL','dz','cx','mç'];

// ----------------------- helpers -----------------------

function buscarProdutoCompleto(id) {
  const p = db.prepare(`
    SELECT
      pr.id, pr.agricultor_id, pr.nome, pr.descricao, pr.preco, pr.unidade,
      pr.estoque, pr.foto_id,
      c.id AS categoria_id, c.nome AS categoria_nome
    FROM produtos pr
    JOIN categorias c ON c.id = pr.categoria_id
    WHERE pr.id = ? AND pr.deleted_at IS NULL
  `).get(id);
  if (!p) return null;
  return {
    id: p.id,
    agricultor_id: p.agricultor_id,
    nome: p.nome,
    descricao: p.descricao,
    preco: p.preco,
    unidade: p.unidade,
    estoque: p.estoque,
    foto_id: p.foto_id,
    categoria: { id: p.categoria_id, nome: p.categoria_nome }
  };
}

// ---------- GET /api/agricultores/:id/produtos — RF10 ----------
produtosPorAgr.get('/', (req, res, next) => {
  try {
    const agricultorId = parseInt(req.params.id, 10);
    const { categoria_id } = req.query;
    const { page, limit, offset } = paginacao(req.query);

    const agr = db.prepare(`
      SELECT id FROM usuarios WHERE id = ? AND role='agricultor' AND deleted_at IS NULL
    `).get(agricultorId);
    if (!agr) throw httpError(404, 'NOT_FOUND', 'Agricultor não encontrado');

    const where = [`pr.agricultor_id = @agricultorId`, `pr.deleted_at IS NULL`];
    const params = { agricultorId };
    if (categoria_id) {
      where.push(`pr.categoria_id = @categoria_id`);
      params.categoria_id = parseInt(categoria_id, 10);
    }
    const whereSQL = `WHERE ${where.join(' AND ')}`;

    const total = db.prepare(`SELECT COUNT(*) AS n FROM produtos pr ${whereSQL}`).get(params).n;

    const rows = db.prepare(`
      SELECT
        pr.id, pr.nome, pr.descricao, pr.preco, pr.unidade,
        pr.estoque, pr.foto_id,
        c.id AS categoria_id, c.nome AS categoria_nome
      FROM produtos pr
      JOIN categorias c ON c.id = pr.categoria_id
      ${whereSQL}
      ORDER BY pr.nome ASC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    const items = rows.map(r => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao,
      preco: r.preco,
      unidade: r.unidade,
      estoque: r.estoque,
      foto_id: r.foto_id,
      categoria: { id: r.categoria_id, nome: r.categoria_nome }
    }));

    res.json({ items, page, limit, total });
  } catch (err) { next(err); }
});

// ---------- POST /api/produtos — RF05, RF06 ----------
produtos.post('/', requireAuth, requireRole('agricultor'), (req, res, next) => {
  try {
    const body = req.body || {};
    obrigatorio(body, ['nome', 'preco', 'unidade', 'categoria_id']);
    const preco        = numeroNaoNegativo(body.preco, 'preco');
    const estoque      = body.estoque !== undefined ? numeroNaoNegativo(body.estoque, 'estoque') : 0;
    const categoria_id = inteiroPositivo(body.categoria_id, 'categoria_id');
    emEnum(body.unidade, 'unidade', UNIDADES);

    const cat = db.prepare('SELECT id FROM categorias WHERE id = ?').get(categoria_id);
    if (!cat) throw httpError(400, 'VALIDATION', 'categoria inexistente');

    let foto_id = body.foto_id ?? null;

    const tx = db.transaction(() => {
      if (foto_id === null) {
        foto_id = criarImagemSeNecessario(body);
      } else {
        const f = db.prepare('SELECT id FROM imagens WHERE id = ?').get(foto_id);
        if (!f) throw httpError(400, 'VALIDATION', 'foto_id inexistente');
      }
      const info = db.prepare(`
        INSERT INTO produtos (agricultor_id, categoria_id, nome, descricao, preco, unidade, estoque, foto_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, categoria_id, body.nome, body.descricao || null,
             preco, body.unidade, estoque, foto_id);
      return info.lastInsertRowid;
    });

    const id = tx();
    res.status(201).json(buscarProdutoCompleto(id));
  } catch (err) { next(err); }
});

// ---------- PATCH /api/produtos/:id — RF05 ----------
produtos.patch('/:id', requireAuth, requireRole('agricultor'), (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = req.body || {};

    const prod = db.prepare(`SELECT * FROM produtos WHERE id = ? AND deleted_at IS NULL`).get(id);
    if (!prod) throw httpError(404, 'NOT_FOUND', 'Produto não encontrado');
    if (prod.agricultor_id !== req.user.id) {
      throw httpError(403, 'FORBIDDEN', 'Produto não pertence ao agricultor logado');
    }

    if (body.preco        !== undefined) numeroNaoNegativo(body.preco, 'preco');
    if (body.estoque      !== undefined) numeroNaoNegativo(body.estoque, 'estoque');
    if (body.categoria_id !== undefined) {
      inteiroPositivo(body.categoria_id, 'categoria_id');
      const cat = db.prepare('SELECT id FROM categorias WHERE id = ?').get(body.categoria_id);
      if (!cat) throw httpError(400, 'VALIDATION', 'categoria inexistente');
    }
    if (body.unidade !== undefined) emEnum(body.unidade, 'unidade', UNIDADES);

    const tx = db.transaction(() => {
      if (body.foto_base64) {
        body.foto_id = criarImagemSeNecessario(body);
      } else if (body.foto_id !== undefined && body.foto_id !== null) {
        const f = db.prepare('SELECT id FROM imagens WHERE id = ?').get(body.foto_id);
        if (!f) throw httpError(400, 'VALIDATION', 'foto_id inexistente');
      }

      const camposEditaveis = ['nome','descricao','preco','unidade','estoque','categoria_id','foto_id'];
      const setCols = camposEditaveis.filter(c => body[c] !== undefined);
      if (setCols.length) {
        const sets = setCols.map(c => `${c} = @${c}`).join(', ');
        const params = Object.fromEntries(setCols.map(c => [c, body[c]]));
        params.id = id;
        db.prepare(`UPDATE produtos SET ${sets} WHERE id = @id`).run(params);
      }
    });
    tx();

    res.json(buscarProdutoCompleto(id));
  } catch (err) { next(err); }
});

// ---------- DELETE /api/produtos/:id — RF04, RF05 (soft delete) ----------
produtos.delete('/:id', requireAuth, requireRole('agricultor'), (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const prod = db.prepare(`SELECT * FROM produtos WHERE id = ? AND deleted_at IS NULL`).get(id);
    if (!prod) throw httpError(404, 'NOT_FOUND', 'Produto não encontrado');
    if (prod.agricultor_id !== req.user.id) {
      throw httpError(403, 'FORBIDDEN', 'Produto não pertence ao agricultor logado');
    }
    db.prepare(`UPDATE produtos SET deleted_at = datetime('now') WHERE id = ?`).run(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- GET /api/imagens/:id — RF03/RF05 (suporte) ----------
imagens.get('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const img = db.prepare(`SELECT dados, mime_type FROM imagens WHERE id = ?`).get(id);
    if (!img) throw httpError(404, 'NOT_FOUND', 'Imagem não encontrada');

    res.set('Content-Type', img.mime_type || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('ETag', `"img-${id}"`);
    res.send(img.dados);
  } catch (err) { next(err); }
});

module.exports = { produtos, produtosPorAgr, imagens };
