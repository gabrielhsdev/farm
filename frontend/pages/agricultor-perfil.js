// pages/agricultor-perfil.js
// RF03/RF09 (GET /agricultores/:id), RF10 (GET /agricultores/:id/produtos),
// RF11 (GET /agricultores/:id/avaliacoes)

import {
  el, limpar, bannerErro, criarAvatar, renderEstrelas,
  formatarMoeda, formatarData, loading, estadoVazio,
} from '../ui.js';
import {
  getAgricultor, listarProdutosDoAgricultor, listarAvaliacoesDoAgricultor,
  imagemUrl,
} from '../api.js';

export async function renderAgricultorPerfil({ outlet, params }) {
  limpar(outlet);
  outlet.appendChild(loading('Carregando perfil...'));

  const id = params.id;

  let agricultor, produtosResp, avaliacoesResp;
  try {
    // Em paralelo: cada uma é um endpoint distinto.
    [agricultor, produtosResp, avaliacoesResp] = await Promise.all([
      getAgricultor(id),
      listarProdutosDoAgricultor(id, { page: 1, limit: 50 }).catch(() => ({ items: [] })),
      listarAvaliacoesDoAgricultor(id, { page: 1, limit: 20 }).catch(() => ({ items: [], resumo: {} })),
    ]);
  } catch (err) {
    limpar(outlet);
    outlet.appendChild(bannerErro(err));
    return;
  }

  limpar(outlet);

  outlet.appendChild(renderHeader(agricultor));

  // Produtos
  const secProd = el('section', { className: 'section' });
  secProd.appendChild(el('h2', { className: 'section-title', text: 'Produtos disponíveis' }));
  const produtos = produtosResp?.items || [];
  if (produtos.length === 0) {
    secProd.appendChild(estadoVazio('Este agricultor ainda não cadastrou produtos.'));
  } else {
    const grid = el('div', { className: 'grid' });
    for (const p of produtos) grid.appendChild(cardProduto(p));
    secProd.appendChild(grid);
  }
  outlet.appendChild(secProd);

  // Avaliações
  const secAval = el('section', { className: 'section' });
  const resumo = avaliacoesResp?.resumo || {};
  const tituloAval = resumo.total
    ? `Avaliações (${resumo.total})`
    : 'Avaliações';
  secAval.appendChild(el('h2', { className: 'section-title', text: tituloAval }));

  const avaliacoes = avaliacoesResp?.items || [];
  if (avaliacoes.length === 0) {
    secAval.appendChild(estadoVazio('Este agricultor ainda não recebeu avaliações.'));
  } else {
    const lista = el('div', { className: 'review-list' });
    for (const av of avaliacoes) lista.appendChild(itemAvaliacao(av));
    secAval.appendChild(lista);
  }
  outlet.appendChild(secAval);
}

function renderHeader(agricultor) {
  // O backend devolve { id, nome, telefone, perfil: { ... } }
  const perfil = agricultor.perfil || {};
  const wrap = el('div', { className: 'profile-header' });

  wrap.appendChild(criarAvatar(agricultor.nome, perfil.foto_id, 96));

  const info = el('div', { className: 'profile-info' });
  info.appendChild(el('h1', { className: 'profile-nome', text: agricultor.nome || 'Agricultor' }));

  const local = [perfil.cidade, perfil.estado].filter(Boolean).join(' / ');
  if (local) info.appendChild(el('p', { className: 'profile-local', text: local }));

  if (perfil.descricao) {
    info.appendChild(el('p', { className: 'profile-descricao', text: perfil.descricao }));
  }

  info.appendChild(renderEstrelas(perfil.media_avaliacoes, perfil.total_avaliacoes));

  // Actions — placeholders desabilitados conforme prompt
  const actions = el('div', { className: 'profile-actions' });

  const wrapAbrir = el('span', {
    className: 'tooltip-wrap',
    attrs: { 'data-tooltip': 'Disponível na Fase B' },
  });
  wrapAbrir.appendChild(el('button', {
    className: 'btn btn-primary',
    text: 'Abrir conversa',
    attrs: { type: 'button', disabled: true },
  }));
  actions.appendChild(wrapAbrir);

  const wrapCarrinho = el('span', {
    className: 'tooltip-wrap',
    attrs: { 'data-tooltip': 'Disponível na Fase B' },
  });
  wrapCarrinho.appendChild(el('button', {
    className: 'btn btn-secondary',
    text: 'Ver carrinho',
    attrs: { type: 'button', disabled: true },
  }));
  actions.appendChild(wrapCarrinho);

  info.appendChild(actions);
  wrap.appendChild(info);
  return wrap;
}

function cardProduto(p) {
  const card = el('div', { className: 'card card-produto' });

  const fotoWrap = el('div', { className: 'produto-foto' });
  if (p.foto_id) {
    const img = el('img', { attrs: { src: imagemUrl(p.foto_id), alt: p.nome || '' } });
    img.addEventListener('error', () => {
      limpar(fotoWrap);
      fotoWrap.textContent = 'Sem foto';
    });
    fotoWrap.appendChild(img);
  } else {
    fotoWrap.textContent = 'Sem foto';
  }
  card.appendChild(fotoWrap);

  card.appendChild(el('p', { className: 'produto-nome', text: p.nome || 'Produto' }));

  if (p.categoria?.nome) {
    card.appendChild(el('span', { className: 'produto-categoria', text: p.categoria.nome }));
  }

  card.appendChild(el('p', {
    className: 'produto-preco',
    text: `${formatarMoeda(p.preco)} / ${p.unidade || 'un'}`,
  }));

  card.appendChild(el('span', {
    className: 'produto-estoque',
    text: `Estoque: ${formatarEstoque(p.estoque, p.unidade)}`,
  }));

  // Placeholder de adicionar ao carrinho
  const wrapBtn = el('span', {
    className: 'tooltip-wrap',
    attrs: { 'data-tooltip': 'Disponível na Fase B' },
  });
  wrapBtn.appendChild(el('button', {
    className: 'btn btn-secondary',
    text: 'Adicionar ao carrinho',
    attrs: { type: 'button', disabled: true },
  }));
  card.appendChild(wrapBtn);

  return card;
}

function formatarEstoque(estoque, unidade) {
  const n = Number(estoque);
  if (!Number.isFinite(n)) return '—';
  // estoque é REAL no schema; mostrar inteiro se for inteiro
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
  return `${txt} ${unidade || 'un'}`;
}

function itemAvaliacao(av) {
  const wrap = el('div', { className: 'review-item' });

  const header = el('div', { className: 'review-header' });
  const author = el('div', { className: 'review-author' });
  author.appendChild(criarAvatar(av.cliente?.nome, null, 32));
  author.appendChild(el('span', { text: av.cliente?.nome || 'Cliente' }));
  header.appendChild(author);

  // Nota visual (estrelas) + data
  const dir = el('div', { className: 'review-header-right' });
  dir.appendChild(renderEstrelas(av.nota, 0));
  if (av.created_at) {
    dir.appendChild(el('div', {
      className: 'review-date',
      text: formatarData(av.created_at),
    }));
  }
  header.appendChild(dir);
  wrap.appendChild(header);

  if (av.comentario) {
    wrap.appendChild(el('p', { className: 'review-comentario', text: av.comentario }));
  }
  return wrap;
}
