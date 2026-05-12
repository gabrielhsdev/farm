// ui.js — helpers DOM puros e formatadores.
//
// Estratégia: nunca usar innerHTML com dados do servidor. Todos os helpers
// abaixo usam textContent + createElement, então XSS via campos do usuário
// fica neutralizado.

import { imagemUrl } from './api.js';

/**
 * Cria um elemento HTML configurado de uma vez.
 * @param {string} tag
 * @param {{className?:string, text?:string, attrs?:object, on?:object,
 *          children?:(Node|null|undefined|false|string)[]}} [opts]
 */
export function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = String(opts.text);
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v === false || v == null) continue;
      if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, String(v));
    }
  }
  if (opts.on) {
    for (const [evt, fn] of Object.entries(opts.on)) {
      node.addEventListener(evt, fn);
    }
  }
  if (opts.children) {
    for (const child of opts.children) {
      if (child == null || child === false) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return node;
}

/** Esvazia um elemento (mais barato que innerHTML = ''). */
export function limpar(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Cria um avatar circular. Se `fotoId` existir, usa <img>; senão renderiza
 * um círculo colorido com a inicial do nome.
 * @param {string} nome
 * @param {number|null|undefined} fotoId
 * @param {number} [tamanho=48] em px
 */
export function criarAvatar(nome, fotoId, tamanho = 48) {
  const wrap = el('div', {
    className: 'avatar',
    attrs: { 'aria-label': `Avatar de ${nome || 'usuário'}` },
  });
  // Único uso permitido de inline style — tamanho dinâmico
  wrap.style.width = `${tamanho}px`;
  wrap.style.height = `${tamanho}px`;
  wrap.style.fontSize = `${Math.round(tamanho * 0.4)}px`;

  if (fotoId) {
    const img = el('img', {
      attrs: { src: imagemUrl(fotoId), alt: nome || '' },
    });
    // se a imagem falhar, faz fallback pra inicial
    img.addEventListener('error', () => {
      limpar(wrap);
      wrap.textContent = inicialDe(nome);
    });
    wrap.appendChild(img);
  } else {
    wrap.textContent = inicialDe(nome);
  }
  return wrap;
}

function inicialDe(nome) {
  if (!nome) return '?';
  const limpo = String(nome).trim();
  if (!limpo) return '?';
  return limpo.charAt(0).toUpperCase();
}

/** Formata número como moeda BRL. */
export function formatarMoeda(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 'R$ —';
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

/** Formata data ISO como dd/mm/yyyy. */
export function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

/**
 * Renderiza um bloco de estrelas (0 a 5) com nota numérica e total entre parênteses.
 * @param {number} media
 * @param {number} total
 */
export function renderEstrelas(media, total) {
  const wrap = el('span', { className: 'card-rating' });
  const mediaNum = Number(media) || 0;
  const cheias = Math.round(mediaNum); // arredondamento simples

  const stars = el('span', { className: 'stars' });
  // Estrelas preenchidas
  stars.appendChild(document.createTextNode('★'.repeat(cheias)));
  // Estrelas vazias num span separado pra ter cor diferente
  if (cheias < 5) {
    const vazias = el('span', {
      className: 'stars-empty',
      text: '★'.repeat(5 - cheias),
    });
    stars.appendChild(vazias);
  }
  wrap.appendChild(stars);

  if (mediaNum > 0) {
    wrap.appendChild(el('span', { text: ` ${mediaNum.toFixed(1)}` }));
  } else {
    wrap.appendChild(el('span', {
      className: 'rating-count',
      text: ' sem avaliações',
    }));
  }
  if (total > 0) {
    wrap.appendChild(el('span', {
      className: 'rating-count',
      text: ` (${total})`,
    }));
  }
  return wrap;
}

/** Banner de erro padronizado. Aceita um Error-like {code,message} ou string. */
export function bannerErro(err) {
  const msg = typeof err === 'string'
    ? err
    : (err?.message || 'Ocorreu um erro inesperado.');
  return el('div', { className: 'banner banner-error', text: msg });
}

/** Estado de loading reutilizável. */
export function loading(texto = 'Carregando...') {
  return el('div', { className: 'loading', text: texto });
}

/** Estado vazio reutilizável. */
export function estadoVazio(texto) {
  return el('div', { className: 'empty-state', text: texto });
}

/**
 * Atalho para construir um <a> que muda o hash via location.hash =
 * (mantém o histórico do browser e dispara o roteador).
 */
export function link(text, href, className) {
  return el('a', {
    text,
    className,
    attrs: { href },
  });
}
