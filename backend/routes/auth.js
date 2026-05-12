const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const { hashSenha, verificarSenha } = require('../utils/senha');
const { obrigatorio, exigirEmail, exigirSenhaMinima, emEnum } = require('../utils/validacao');
const { httpError } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function gerarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, role: usuario.role, nome: usuario.nome },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '240h' }
  );
}

// POST /api/auth/register — RF01
router.post('/register', async (req, res, next) => {
  try {
    const { nome, email, senha, role, telefone } = req.body || {};
    obrigatorio(req.body || {}, ['nome', 'email', 'senha', 'role']);
    exigirEmail(email);
    exigirSenhaMinima(senha);
    emEnum(role, 'role', ['cliente', 'agricultor']);

    const existente = db.prepare(
      `SELECT id FROM usuarios WHERE email = ? AND deleted_at IS NULL`
    ).get(email);
    if (existente) throw httpError(409, 'EMAIL_EM_USO', 'Email já cadastrado');

    const senha_hash = await hashSenha(senha);

    const criar = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO usuarios (nome, email, senha_hash, role, telefone)
        VALUES (?, ?, ?, ?, ?)
      `).run(nome, email, senha_hash, role, telefone || null);

      // Se for agricultor, cria perfil vazio
      if (role === 'agricultor') {
        db.prepare(`INSERT INTO perfis_agricultor (usuario_id) VALUES (?)`).run(info.lastInsertRowid);
      }
      return info.lastInsertRowid;
    });

    const id = criar();
    const usuario = { id, nome, email, role };
    const token = gerarToken(usuario);

    res.status(201).json({ token, usuario });
  } catch (err) { next(err); }
});

// POST /api/auth/login — RF02
router.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = req.body || {};
    obrigatorio(req.body || {}, ['email', 'senha']);

    const u = db.prepare(`
      SELECT id, nome, email, senha_hash, role
      FROM usuarios WHERE email = ? AND deleted_at IS NULL
    `).get(email);

    // Mensagem genérica para não vazar existência do email
    const cred401 = httpError(401, 'CREDENCIAIS_INVALIDAS', 'Email ou senha inválidos');

    if (!u) throw cred401;
    const ok = await verificarSenha(senha, u.senha_hash);
    if (!ok) throw cred401;

    const usuario = { id: u.id, nome: u.nome, email: u.email, role: u.role };
    const token = gerarToken(usuario);
    res.json({ token, usuario });
  } catch (err) { next(err); }
});

// POST /api/auth/logout — RF02
router.post('/logout', requireAuth, (req, res) => {
  // JWT é stateless: cliente descarta o token. Servidor apenas confirma.
  res.json({ ok: true });
});

// GET /api/auth/me — RF02
router.get('/me', requireAuth, (req, res, next) => {
  try {
    const u = db.prepare(`
      SELECT id, nome, email, role, telefone
      FROM usuarios WHERE id = ? AND deleted_at IS NULL
    `).get(req.user.id);
    if (!u) throw httpError(401, 'UNAUTHORIZED', 'Usuário não encontrado');
    res.json(u);
  } catch (err) { next(err); }
});

module.exports = router;
