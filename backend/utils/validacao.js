const { httpError } = require('../middleware/error');

/**
 * Helpers simples de validação. Lançam httpError(400, ...) em falha.
 */

function obrigatorio(obj, campos) {
  const faltando = campos.filter(c => obj[c] === undefined || obj[c] === null || obj[c] === '');
  if (faltando.length) {
    throw httpError(400, 'VALIDATION', 'Campos obrigatórios ausentes', { campos: faltando });
  }
}

function emailValido(email) {
  if (typeof email !== 'string') return false;
  // Regex simples e suficiente para o escopo
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function exigirEmail(email) {
  if (!emailValido(email)) {
    throw httpError(400, 'VALIDATION', 'Email inválido');
  }
}

function exigirSenhaMinima(senha, min = 6) {
  if (typeof senha !== 'string' || senha.length < min) {
    throw httpError(400, 'VALIDATION', `Senha deve ter ao menos ${min} caracteres`);
  }
}

function numeroPositivo(valor, nome) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw httpError(400, 'VALIDATION', `${nome} deve ser número positivo`);
  }
  return n;
}

function numeroNaoNegativo(valor, nome) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) {
    throw httpError(400, 'VALIDATION', `${nome} deve ser número não negativo`);
  }
  return n;
}

function inteiroPositivo(valor, nome) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw httpError(400, 'VALIDATION', `${nome} deve ser inteiro positivo`);
  }
  return n;
}

function emEnum(valor, nome, valoresValidos) {
  if (!valoresValidos.includes(valor)) {
    throw httpError(400, 'VALIDATION', `${nome} inválido`, { aceitos: valoresValidos });
  }
}

function paginacao(query) {
  let page  = parseInt(query.page,  10) || 1;
  let limit = parseInt(query.limit, 10) || 20;
  if (page  < 1)  page  = 1;
  if (limit < 1)  limit = 1;
  if (limit > 50) limit = 50;
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = {
  obrigatorio,
  emailValido,
  exigirEmail,
  exigirSenhaMinima,
  numeroPositivo,
  numeroNaoNegativo,
  inteiroPositivo,
  emEnum,
  paginacao
};
