const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { paginacao } = require('../utils/validacao');
const { httpError } = require('../middleware/error');

const router = express.Router();

// GET /api/agricultores — RF09
router.get('/', (req, res, next) => {
  try {
    const { q, cidade, estado } = req.query;
    const { page, limit, offset } = paginacao(req.query);

    if (estado && String(estado).length !== 2) {
      throw httpError(400, 'VALIDATION', 'estado deve ter 2 caracteres');
    }

    const where = [`u.role = 'agricultor'`, `u.deleted_at IS NULL`];
    const params = {};

    if (q) {
      where.push(`(u.nome LIKE @q OR p.descricao LIKE @q)`);
      params.q = `%${q}%`;
    }
    if (cidade) { where.push(`p.cidade = @cidade`); params.cidade = cidade; }
    if (estado) { where.push(`p.estado = @estado`); params.estado = estado; }

    const whereSQL = `WHERE ${where.join(' AND ')}`;

    const total = db.prepare(`
      SELECT COUNT(*) AS n
      FROM usuarios u
      LEFT JOIN perfis_agricultor p ON p.usuario_id = u.id
      ${whereSQL}
    `).get(params).n;

    const items = db.prepare(`
      SELECT
        u.id,
        u.nome,
        p.cidade,
        p.estado,
        p.media_avaliacoes,
        p.total_avaliacoes,
        p.foto_id
      FROM usuarios u
      LEFT JOIN perfis_agricultor p ON p.usuario_id = u.id
      ${whereSQL}
      ORDER BY p.media_avaliacoes DESC, u.nome ASC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    res.json({ items, page, limit, total });
  } catch (err) { next(err); }
});

// GET /api/agricultores/:id — RF03, RF09
router.get('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare(`
      SELECT
        u.id, u.nome, u.telefone,
        p.descricao, p.cidade, p.estado, p.cep,
        p.latitude, p.longitude, p.foto_id,
        p.media_avaliacoes, p.total_avaliacoes
      FROM usuarios u
      LEFT JOIN perfis_agricultor p ON p.usuario_id = u.id
      WHERE u.id = ? AND u.role = 'agricultor' AND u.deleted_at IS NULL
    `).get(id);

    if (!row) throw httpError(404, 'NOT_FOUND', 'Agricultor não encontrado');

    res.json({
      id: row.id,
      nome: row.nome,
      telefone: row.telefone,
      perfil: {
        descricao: row.descricao,
        cidade: row.cidade,
        estado: row.estado,
        cep: row.cep,
        latitude: row.latitude,
        longitude: row.longitude,
        foto_id: row.foto_id,
        media_avaliacoes: row.media_avaliacoes,
        total_avaliacoes: row.total_avaliacoes
      }
    });
  } catch (err) { next(err); }
});

// PATCH /api/agricultores/me — RF03
router.patch('/me', requireAuth, requireRole('agricultor'), (req, res, next) => {
  try {
    const body = req.body || {};
    const camposUsuario = ['nome', 'telefone'];
    const camposPerfil  = ['descricao', 'cidade', 'estado', 'cep', 'latitude', 'longitude', 'foto_id'];

    if (body.estado !== undefined && body.estado !== null && String(body.estado).length !== 2) {
      throw httpError(400, 'VALIDATION', 'estado deve ter 2 caracteres');
    }
    if (body.latitude !== undefined && body.latitude !== null) {
      const lat = Number(body.latitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw httpError(400, 'VALIDATION', 'latitude fora de range');
      }
    }
    if (body.longitude !== undefined && body.longitude !== null) {
      const lng = Number(body.longitude);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw httpError(400, 'VALIDATION', 'longitude fora de range');
      }
    }
    if (body.foto_id !== undefined && body.foto_id !== null) {
      const f = db.prepare('SELECT id FROM imagens WHERE id = ?').get(body.foto_id);
      if (!f) throw httpError(400, 'VALIDATION', 'foto_id inexistente');
    }

    const updateUsuario = camposUsuario.filter(c => body[c] !== undefined);
    const updatePerfil  = camposPerfil.filter(c  => body[c] !== undefined);

    const tx = db.transaction(() => {
      if (updateUsuario.length) {
        const sets = updateUsuario.map(c => `${c} = @${c}`).join(', ');
        const params = Object.fromEntries(updateUsuario.map(c => [c, body[c]]));
        params.id = req.user.id;
        db.prepare(`UPDATE usuarios SET ${sets} WHERE id = @id`).run(params);
      }
      if (updatePerfil.length) {
        const sets = updatePerfil.map(c => `${c} = @${c}`).join(', ');
        const params = Object.fromEntries(updatePerfil.map(c => [c, body[c]]));
        params.usuario_id = req.user.id;
        db.prepare(`UPDATE perfis_agricultor SET ${sets} WHERE usuario_id = @usuario_id`).run(params);
      }
    });
    tx();

    // Devolve perfil atualizado
    const row = db.prepare(`
      SELECT
        u.id, u.nome, u.telefone,
        p.descricao, p.cidade, p.estado, p.cep,
        p.latitude, p.longitude, p.foto_id,
        p.media_avaliacoes, p.total_avaliacoes
      FROM usuarios u
      LEFT JOIN perfis_agricultor p ON p.usuario_id = u.id
      WHERE u.id = ?
    `).get(req.user.id);

    res.json({
      id: row.id,
      nome: row.nome,
      telefone: row.telefone,
      perfil: {
        descricao: row.descricao,
        cidade: row.cidade,
        estado: row.estado,
        cep: row.cep,
        latitude: row.latitude,
        longitude: row.longitude,
        foto_id: row.foto_id,
        media_avaliacoes: row.media_avaliacoes,
        total_avaliacoes: row.total_avaliacoes
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
