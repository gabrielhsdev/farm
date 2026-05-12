// router.js — hash router minimalista.
//
// Padrão de uso:
//   router.register('#/agricultores/:id', ({ outlet, params, query }) => { ... });
//   router.register('#/conversas/:id', ({ outlet, params, query }) => { ... });
//   router.setNotFound(({ outlet }) => { outlet.textContent = '404'; });
//   router.setOutlet(document.getElementById('app'));
//   router.start();
//
// Handlers podem ser async — o router só espera resolver pra liberar o próximo.

const routes = []; // [{ pattern, regex, keys, handler }]
let outletEl = null;
let notFoundHandler = null;
let currentToken = 0; // protege contra navegações sobrepostas

/**
 * Converte 'hash-pattern' em regex + nomes de params.
 * Ex.: '#/agricultores/:id' → /^#\/agricultores\/([^/]+)$/ com keys=['id']
 */
function compile(pattern) {
  const keys = [];
  // Primeiro extraímos os :params (antes de escapar), substituindo por placeholders
  // que não colidam com regex. Depois escapamos o resto, depois trocamos os
  // placeholders pelo grupo de captura.
  const placeholders = [];
  let intermediate = pattern.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => {
    keys.push(k);
    const ph = `\x00PH${placeholders.length}\x00`;
    placeholders.push(ph);
    return ph;
  });
  // Escapa caracteres regex no que sobrou
  intermediate = intermediate.replace(/[.+*?^${}()|[\]\\/]/g, '\\$&');
  // Coloca os grupos de captura no lugar dos placeholders
  for (const ph of placeholders) {
    intermediate = intermediate.replace(ph, '([^/]+)');
  }
  return { regex: new RegExp('^' + intermediate + '$'), keys };
}

/** Parseia o trecho após '?' do hash em objeto { k: v }. */
function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  for (const part of qs.split('&')) {
    if (!part) continue;
    const idx = part.indexOf('=');
    const k = idx === -1 ? part : part.slice(0, idx);
    const v = idx === -1 ? '' : part.slice(idx + 1);
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

/**
 * Registra uma rota.
 * @param {string} pattern — começa com '#/', usa ':param' para segmentos.
 * @param {(ctx:{outlet:HTMLElement, params:object, query:object}) => any|Promise<any>} handler
 */
export function register(pattern, handler) {
  const { regex, keys } = compile(pattern);
  routes.push({ pattern, regex, keys, handler });
}

/** Handler de fallback (404). */
export function setNotFound(handler) {
  notFoundHandler = handler;
}

/** Define o elemento raiz onde as páginas são renderizadas. */
export function setOutlet(node) {
  outletEl = node;
}

/** Navega programaticamente. */
export function navigate(hash) {
  if (typeof hash !== 'string') return;
  if (!hash.startsWith('#')) hash = '#' + hash;
  if (location.hash === hash) {
    // mesmo hash → força re-render manual
    resolve();
  } else {
    location.hash = hash;
  }
}

/** Substitui o hash sem entrar no histórico (útil em redirects iniciais). */
export function replace(hash) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  const url = location.pathname + location.search + hash;
  history.replaceState(null, '', url);
  resolve();
}

/** Resolve o hash atual e renderiza a rota correspondente. */
async function resolve() {
  if (!outletEl) return;

  const raw = location.hash || '#/';
  const [path, qs] = raw.split('?');
  const query = parseQuery(qs);

  const token = ++currentToken;

  let matched = null;
  let params = {};

  for (const route of routes) {
    const m = path.match(route.regex);
    if (m) {
      matched = route;
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      break;
    }
  }

  // mostra loading enquanto o handler resolve
  outletEl.replaceChildren();
  outletEl.appendChild(
    Object.assign(document.createElement('div'), {
      className: 'loading',
      textContent: 'Carregando...',
    })
  );

  try {
    if (matched) {
      await matched.handler({ outlet: outletEl, params, query });
    } else if (notFoundHandler) {
      await notFoundHandler({ outlet: outletEl, params: {}, query });
    } else {
      outletEl.replaceChildren();
      outletEl.appendChild(
        Object.assign(document.createElement('div'), {
          className: 'banner banner-error',
          textContent: 'Rota não encontrada: ' + path,
        })
      );
    }
  } catch (err) {
    // Se outra navegação aconteceu enquanto esperávamos, abortamos silenciosamente.
    if (token !== currentToken) return;
    console.error('[router] erro renderizando', path, err);
    outletEl.replaceChildren();
    outletEl.appendChild(
      Object.assign(document.createElement('div'), {
        className: 'banner banner-error',
        textContent: (err && err.message) || 'Falha ao carregar a página.',
      })
    );
  }
}

/** Lê o hash atual e força um re-render (útil após mudanças de auth). */
export function refresh() {
  resolve();
}

/** Inicia o roteador: escuta hashchange e resolve o atual. */
export function start() {
  window.addEventListener('hashchange', resolve);
  // se entraram sem hash, manda pra '#/'
  if (!location.hash) {
    location.hash = '#/';
  } else {
    resolve();
  }
}
