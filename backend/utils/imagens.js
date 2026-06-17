const db = require('../db/connection');
const { httpError } = require('../middleware/error');

const MIME_VALIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Recebe { foto_base64, foto_mime } no body e cria registro em imagens.
 * Retorna o id da imagem criada, ou null se nada foi enviado.
 */
function criarImagemSeNecessario(body) {
  if (!body.foto_base64) return null;

  const mime = body.foto_mime || 'image/jpeg';
  if (!MIME_VALIDOS.includes(mime)) {
    throw httpError(400, 'VALIDATION', 'foto_mime inválido', { aceitos: MIME_VALIDOS });
  }
  let buf;
  try {
    buf = Buffer.from(body.foto_base64, 'base64');
  } catch {
    throw httpError(400, 'VALIDATION', 'foto_base64 inválida');
  }
  if (buf.length === 0) throw httpError(400, 'VALIDATION', 'foto_base64 vazia');
  if (buf.length > MAX_IMG_BYTES) {
    throw httpError(400, 'VALIDATION', `imagem excede ${MAX_IMG_BYTES} bytes`);
  }

  const info = db.prepare(`
    INSERT INTO imagens (dados, mime_type, tamanho) VALUES (?, ?, ?)
  `).run(buf, mime, buf.length);
  return info.lastInsertRowid;
}

module.exports = { criarImagemSeNecessario, MIME_VALIDOS, MAX_IMG_BYTES };
