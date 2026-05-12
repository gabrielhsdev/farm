const bcrypt = require('bcryptjs');

const ROUNDS = 10;

async function hashSenha(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

async function verificarSenha(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashSenha, verificarSenha };
