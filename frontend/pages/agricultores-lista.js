// pages/agricultores-lista.js — RF09 (GET /agricultores com filtros + paginação)

import { el, limpar, bannerErro, criarAvatar, renderEstrelas, loading, estadoVazio } from '../ui.js';
import { listarAgricultores } from '../api.js';

const LIMIT = 12;

export async function renderAgricultoresLista({ outlet, query }) {
  limpar(outlet);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const q = query.q || '';
  const cidade = query.cidade || '';
  const estado = (query.estado || '').toUpperCase().slice(0, 2);

  // Header
  outlet.appendChild(el('div', {
    className: 'page-header',
    children: [
      el('h1', { className: 'page-title', text: 'Agricultores' }),
      el('p', { className: 'page-subtitle', text: 'Encontre quem produz pertinho de você.' }),
    ],
  }));

  // Filters
  const form = el('form', { className: 'filters', attrs: { role: 'search' } });

  const qField = el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'Buscar por nome', attrs: { for: 'f-q' } }),
      el('input', { attrs: { id: 'f-q', name: 'q', type: 'search', value: q, placeholder: 'Ex: Sítio Boa Terra' } }),
    ],
  });
  const cidadeField = el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'Cidade', attrs: { for: 'f-cidade' } }),
      el('input', { attrs: { id: 'f-cidade', name: 'cidade', type: 'text', value: cidade } }),
    ],
  });
  const estadoField = el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'UF', attrs: { for: 'f-estado' } }),
      el('input', { attrs: { id: 'f-estado', name: 'estado', type: 'text', value: estado, maxlength: 2, placeholder: 'SP' } }),
    ],
  });

  form.appendChild(qField);
  form.appendChild(cidadeField);
  form.appendChild(estadoField);

  const actions = el('div', { className: 'filters-actions' });
  actions.appendChild(el('button', {
    className: 'btn btn-primary',
    text: 'Filtrar',
    attrs: { type: 'submit' },
  }));
  actions.appendChild(el('button', {
    className: 'btn btn-ghost',
    text: 'Limpar',
    attrs: { type: 'button' },
    on: {
      click: () => { location.hash = '#/agricultores'; },
    },
  }));
  form.appendChild(actions);

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const params = new URLSearchParams();
    const novoQ = form.elements.q.value.trim();
    const novoCidade = form.elements.cidade.value.trim();
    const novoEstado = form.elements.estado.value.trim().toUpperCase();
    if (novoQ) params.set('q', novoQ);
    if (novoCidade) params.set('cidade', novoCidade);
    if (novoEstado) params.set('estado', novoEstado);
    const qs = params.toString();
    location.hash = '#/agricultores' + (qs ? '?' + qs : '');
  });

  outlet.appendChild(form);

  // Results area
  const resultsArea = el('div');
  outlet.appendChild(resultsArea);
  resultsArea.appendChild(loading());

  try {
    const data = await listarAgricultores({
      q: q || undefined,
      cidade: cidade || undefined,
      estado: estado || undefined,
      page,
      limit: LIMIT,
    });

    limpar(resultsArea);

    const items = data?.items || [];
    if (items.length === 0) {
      resultsArea.appendChild(estadoVazio('Nenhum agricultor encontrado com esses filtros.'));
      return;
    }

    const grid = el('div', { className: 'grid' });
    for (const a of items) {
      grid.appendChild(cardAgricultor(a));
    }
    resultsArea.appendChild(grid);

    // Pagination
    const total = data.total || items.length;
    const totalPaginas = Math.max(1, Math.ceil(total / LIMIT));
    resultsArea.appendChild(paginacao(page, totalPaginas, { q, cidade, estado }));

  } catch (err) {
    limpar(resultsArea);
    resultsArea.appendChild(bannerErro(err));
  }
}

function cardAgricultor(a) {
  const card = el('a', {
    className: 'card card-link card-agricultor',
    attrs: { href: `#/agricultores/${a.id}` },
  });

  card.appendChild(criarAvatar(a.nome, a.foto_id, 72));
  card.appendChild(el('p', { className: 'card-nome', text: a.nome || 'Agricultor' }));

  const cidade = a.cidade || '';
  const estado = a.estado || '';
  const local = [cidade, estado].filter(Boolean).join(' / ');
  card.appendChild(el('p', {
    className: 'card-local',
    text: local || 'Localização não informada',
  }));

  card.appendChild(renderEstrelas(a.media_avaliacoes, a.total_avaliacoes));

  return card;
}

function paginacao(pageAtual, totalPaginas, filtros) {
  const wrap = el('div', { className: 'pagination' });

  function hashPara(p) {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.cidade) params.set('cidade', filtros.cidade);
    if (filtros.estado) params.set('estado', filtros.estado);
    if (p > 1) params.set('page', p);
    const qs = params.toString();
    return '#/agricultores' + (qs ? '?' + qs : '');
  }

  const prev = el('button', {
    className: 'btn btn-secondary',
    text: '← Anterior',
    attrs: { type: 'button' },
    on: {
      click: () => { if (pageAtual > 1) location.hash = hashPara(pageAtual - 1); },
    },
  });
  if (pageAtual <= 1) prev.disabled = true;

  const next = el('button', {
    className: 'btn btn-secondary',
    text: 'Próxima →',
    attrs: { type: 'button' },
    on: {
      click: () => { if (pageAtual < totalPaginas) location.hash = hashPara(pageAtual + 1); },
    },
  });
  if (pageAtual >= totalPaginas) next.disabled = true;

  wrap.appendChild(prev);
  wrap.appendChild(el('span', {
    className: 'pagination-info',
    text: `Página ${pageAtual} de ${totalPaginas}`,
  }));
  wrap.appendChild(next);

  return wrap;
}
