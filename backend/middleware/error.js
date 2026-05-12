/**
 * Handler de erro central. Espera erros com .status e .code, ou usa defaults.
 *
 * Padrão da resposta: { error: { code, message, details? } }
 */
function errorHandler(err, req, res, next) {
  // Erros de validação manual lançados pelas rotas
  const status  = err.status  || 500;
  const code    = err.code    || (status === 500 ? 'INTERNAL' : 'ERROR');
  const message = err.message || 'Erro interno';

  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} →`, err);
  }

  const body = { error: { code, message } };
  if (err.details) body.error.details = err.details;

  res.status(status).json(body);
}

/**
 * Helper para criar erros HTTP estruturados.
 *   throw httpError(400, 'BAD_REQUEST', 'campo X faltando')
 */
function httpError(status, code, message, details) {
  const e = new Error(message);
  e.status  = status;
  e.code    = code;
  if (details) e.details = details;
  return e;
}

module.exports = { errorHandler, httpError };
