const jwt = require('jsonwebtoken');

/**
 * Valida o JWT do header Authorization: Bearer <token>.
 * Em sucesso, anexa { id, role } a req.user.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Token ausente' }
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return res.status(401).json({
      error: { code, message: 'Token inválido ou expirado' }
    });
  }
}

module.exports = { requireAuth };
