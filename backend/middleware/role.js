/**
 * Fábrica que retorna middleware que exige um role específico.
 * Deve rodar APÓS requireAuth.
 *
 *   router.post('/produtos', requireAuth, requireRole('agricultor'), handler)
 */
function requireRole(role) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária' }
      });
    }
    if (req.user.role !== role) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `Apenas ${role} pode acessar este recurso` }
      });
    }
    next();
  };
}

module.exports = { requireRole };
