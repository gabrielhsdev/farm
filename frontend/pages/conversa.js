// pages/conversa.js — RF08 (chat + snapshot bubble) — Fase B
//
// Duas portas de entrada:
//   - renderConversa: rota #/conversas/:id     — conversa já existe
//   - renderConversaCom: rota #/conversas/com/:outroId
//                                  — pode ser conversa existente ou pré-rascunho.
//                                    Tenta resolver via listarConversas; se não achar,
//                                    abre tela "vazia" e a primeira mensagem cria
//                                    a conversa no backend, depois faz replace pra
//                                    #/conversas/:novoId.
//
// Polling:
//   A cada 3s chama GET /conversas/:id/mensagens?since=<server_time>.
//   O timer é parado:
//     1) ao mudar de rota (hashchange — registrado com { once:true })
//     2) ao desmontar a página (MutationObserver no outlet)
//     3) idempotente: pararPolling() pode ser chamado várias vezes.
//
// Sem 'innerHTML' com dados do backend. Sempre via el() + textContent.

import {
  el, limpar, bannerErro, criarAvatar, loading,
  formatarMoeda, formatarHora, formatarData, estadoVazio, toast,
} from '../ui.js';
import {
  listarConversas, listarMensagens, enviarMensagem, getAgricultor,
} from '../api.js';
import { getUser } from '../auth.js';
import { replace, navigate } from '../router.js';
import { abrirModalGerarPedido } from './modal-gerar-pedido.js';

const POLL_MS = 3000;
const SNAPSHOT_ITENS_VISIVEIS = 5;

// ===================================================================
// Rota #/conversas/:id — conversa já existe
// ===================================================================
export async function renderConversa({ outlet, params }) {
  await montarConversa(outlet, { conversaId: params.id });
}

// ===================================================================
// Rota #/conversas/com/:outroId — pode ou não existir
// ===================================================================
export async function renderConversaCom({ outlet, params }) {
  limpar(outlet);
  outlet.appendChild(loading('Abrindo conversa...'));

  const outroId = Number(params.outroId);

  // Tenta achar conversa existente
  try {
    const conversas = await listarConversas();
    const achada = (conversas || []).find((c) => Number(c.outro?.id) === outroId);
    if (achada) {
      // Replace pra rota canônica — a renderConversa monta tudo do zero
      replace(`#/conversas/${achada.id}`);
      return;
    }
  } catch (err) {
    // Não bloqueia: cai pro modo "pré-rascunho" mesmo
    console.warn('[conversa] falha ao buscar conversa existente:', err);
  }

  // Não existe ainda → pré-rascunho
  await montarConversa(outlet, { conversaId: null, outroIdAlvo: outroId });
}

// ===================================================================
// Montagem comum
// ===================================================================
async function montarConversa(outlet, { conversaId, outroIdAlvo }) {
  limpar(outlet);
  outlet.appendChild(loading('Carregando conversa...'));

  const user = getUser();
  if (!user) {
    // Defensivo: o guard já deve ter pego. Mas se passou, redireciona.
    location.hash = '#/login';
    return;
  }

  // Estado mutável da página (capturado nos closures)
  const estado = {
    conversaId,       // null no modo pré-rascunho
    outroId: outroIdAlvo || null,
    outroNome: null,
    outroFotoId: null,
    user,
    mensagens: [],    // já renderizadas
    serverTime: null, // cursor de polling
    pollTimer: null,
    observer: null,
    hashListener: null,
    desmontado: false,
  };

  // Se já temos conversaId, carregamos o histórico em paralelo com a lista de
  // conversas (para descobrir nome/role do outro lado, mesmo se for cliente).
  if (estado.conversaId) {
    try {
      const [resp, conversas] = await Promise.all([
        listarMensagens(estado.conversaId),
        listarConversas().catch(() => null),
      ]);
      estado.mensagens = resp?.mensagens || [];
      estado.serverTime = resp?.server_time || null;

      // Resolve outro lado via listarConversas (formato { id, outro:{id,nome,role}, ... })
      if (Array.isArray(conversas)) {
        const minha = conversas.find((c) => Number(c.id) === Number(estado.conversaId));
        if (minha?.outro) {
          estado.outroId = Number(minha.outro.id);
          estado.outroNome = minha.outro.nome || null;
          estado.outroRole = minha.outro.role || null;
        }
      }
      // Fallback: infere outroId pelas mensagens se ainda não temos
      if (!estado.outroId) {
        const outraMsg = estado.mensagens.find((m) => Number(m.remetente_id) !== Number(user.id));
        if (outraMsg) estado.outroId = Number(outraMsg.remetente_id);
      }
    } catch (err) {
      limpar(outlet);
      outlet.appendChild(bannerErro(err));
      return;
    }
  }

  // Se o "outro" for um agricultor, pegamos a foto pra header.
  // (Sabemos isso pelo role do outro OU, no pré-rascunho, pelo role do user logado:
  //  cliente está conversando com agricultor.)
  const outroEhAgricultor =
    estado.outroRole === 'agricultor' ||
    (!estado.outroRole && estado.user.role === 'cliente');
  if (estado.outroId && outroEhAgricultor) {
    try {
      const ag = await getAgricultor(estado.outroId);
      if (!estado.outroNome) estado.outroNome = ag?.nome || null;
      estado.outroFotoId = ag?.perfil?.foto_id || null;
    } catch {
      // perfil indisponível — header fica com inicial
    }
  }

  // Render
  limpar(outlet);
  const root = el('div', { className: 'conversa-root' });
  outlet.appendChild(root);

  root.appendChild(renderHeaderConversa(estado));

  const listaWrap = el('div', { className: 'conversa-mensagens' });
  root.appendChild(listaWrap);

  // Slot de erro de envio (não bloqueia o form)
  const erroEnvio = el('div', { className: 'conversa-erro-envio' });
  root.appendChild(erroEnvio);

  const formWrap = renderForm(estado, listaWrap, erroEnvio, outlet);
  root.appendChild(formWrap);

  // Render inicial das mensagens
  if (!estado.conversaId && estado.mensagens.length === 0) {
    listaWrap.appendChild(estadoVazio(
      'Comece a conversa! Sua primeira mensagem cria a thread.'
    ));
  } else {
    redesenharMensagens(estado, listaWrap);
    scrollFim(listaWrap);
  }

  // Polling — só liga se a conversa já existe
  if (estado.conversaId) {
    iniciarPolling(estado, listaWrap);
  }

  // Limpeza ao desmontar
  configurarTeardown(estado, outlet);
}

// ===================================================================
// Header da conversa
// ===================================================================
function renderHeaderConversa(estado) {
  const wrap = el('div', { className: 'conversa-header' });

  const btnVoltar = el('a', {
    className: 'btn btn-ghost conversa-btn-voltar',
    text: '← Voltar',
    attrs: { href: '#/conversas' },
  });
  wrap.appendChild(btnVoltar);

  const info = el('div', { className: 'conversa-header-info' });
  info.appendChild(criarAvatar(estado.outroNome || 'Conversa', estado.outroFotoId, 40));

  const txt = el('div');
  txt.appendChild(el('p', {
    className: 'conversa-header-nome',
    text: estado.outroNome || (estado.user.role === 'cliente' ? 'Agricultor' : 'Cliente'),
  }));
  if (!estado.conversaId) {
    txt.appendChild(el('p', {
      className: 'conversa-header-sub',
      text: 'Nova conversa',
    }));
  }
  info.appendChild(txt);

  wrap.appendChild(info);
  return wrap;
}

// ===================================================================
// Lista de mensagens
// ===================================================================
function redesenharMensagens(estado, listaWrap) {
  limpar(listaWrap);

  if (estado.mensagens.length === 0) {
    listaWrap.appendChild(estadoVazio('Sem mensagens ainda.'));
    return;
  }

  // Agrupa por data para colocar um separador "Hoje", "12/05/2026" etc.
  let ultimoDia = null;
  for (const m of estado.mensagens) {
    const dia = formatarData(m.created_at);
    if (dia !== ultimoDia) {
      listaWrap.appendChild(el('div', { className: 'conversa-dia', text: dia || '—' }));
      ultimoDia = dia;
    }
    listaWrap.appendChild(montarBolha(m, estado));
  }
}

function montarBolha(m, estado) {
  const minha = Number(m.remetente_id) === Number(estado.user.id);
  const wrap = el('div', {
    className: `bolha-wrap ${minha ? 'bolha-mine' : 'bolha-other'}`,
  });

  const bolha = el('div', {
    className: `bolha ${m.tipo === 'snapshot' ? 'bolha-snapshot' : 'bolha-texto'}`,
  });

  if (m.tipo === 'snapshot') {
    montarBolhaSnapshot(bolha, m, estado, minha);
  } else {
    bolha.appendChild(el('p', { className: 'bolha-conteudo', text: m.conteudo || '' }));
  }

  bolha.appendChild(el('span', {
    className: 'bolha-hora',
    text: formatarHora(m.created_at),
  }));

  wrap.appendChild(bolha);
  return wrap;
}

function montarBolhaSnapshot(bolha, m, estado, minha) {
  const snap = m.snapshot_json || {};
  const itens = Array.isArray(snap.itens) ? snap.itens : [];

  const titulo = minha ? '📦 Carrinho enviado' : '📦 Carrinho recebido';
  bolha.appendChild(el('p', { className: 'snap-titulo', text: titulo }));

  const lista = el('ul', { className: 'snap-itens' });
  const visiveis = itens.slice(0, SNAPSHOT_ITENS_VISIVEIS);
  for (const it of visiveis) {
    const subtotal = (it.subtotal != null)
      ? it.subtotal
      : (Number(it.preco_unit || 0) * Number(it.quantidade || 0));
    const li = el('li', { className: 'snap-item' });
    const qtdTxt = formatarQtd(it.quantidade);
    li.appendChild(el('span', {
      className: 'snap-item-nome',
      text: `${qtdTxt} × ${it.nome || 'Produto'}`,
    }));
    li.appendChild(el('span', {
      className: 'snap-item-valor',
      text: formatarMoeda(subtotal),
    }));
    lista.appendChild(li);
  }
  if (itens.length > SNAPSHOT_ITENS_VISIVEIS) {
    const restante = itens.length - SNAPSHOT_ITENS_VISIVEIS;
    lista.appendChild(el('li', {
      className: 'snap-item snap-item-extra',
      text: `+ ${restante} ite${restante === 1 ? 'm' : 'ns'}`,
    }));
  }
  bolha.appendChild(lista);

  const totalBox = el('div', { className: 'snap-total' });
  totalBox.appendChild(el('span', { text: 'Total' }));
  totalBox.appendChild(el('strong', { text: formatarMoeda(snap.total || 0) }));
  bolha.appendChild(totalBox);

  // Botão "Gerar pedido" — só pra agricultor e quando a snapshot é da outra parte (cliente)
  // Fase D: ativado. Abre o modal de criação de pedido.
  const ehAgricultor = estado.user.role === 'agricultor';
  if (ehAgricultor && !minha) {
    bolha.appendChild(el('button', {
      className: 'btn btn-primary snap-btn-pedido',
      text: 'Gerar pedido',
      attrs: { type: 'button' },
      on: {
        click: () => {
          abrirModalGerarPedido({
            mensagemSnapshotId: m.id,
            snapshotJson: snap,
            onCriado: (pedido) => {
              toast('Pedido criado', { tipo: 'success' });
              // Navega pro detalhe — caller decide a transição, não o modal.
              navigate('#/pedidos/' + pedido.id);
            },
          });
        },
      },
    }));
  }
}

function formatarQtd(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return '?';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace('.', ',');
}

function scrollFim(listaWrap) {
  // requestAnimationFrame garante que o DOM já está atualizado
  requestAnimationFrame(() => {
    listaWrap.scrollTop = listaWrap.scrollHeight;
  });
}

// ===================================================================
// Form de envio
// ===================================================================
function renderForm(estado, listaWrap, erroEnvio, outlet) {
  const form = el('form', { className: 'conversa-form', attrs: { novalidate: true } });

  const input = el('input', {
    attrs: {
      type: 'text',
      name: 'conteudo',
      placeholder: 'Escreva uma mensagem...',
      autocomplete: 'off',
    },
  });
  form.appendChild(input);

  const btn = el('button', {
    className: 'btn btn-primary',
    text: 'Enviar',
    attrs: { type: 'submit' },
  });
  form.appendChild(btn);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    limpar(erroEnvio);

    const conteudo = input.value.trim();
    if (!conteudo) {
      // Validação client-side: nada a fazer.
      input.focus();
      return;
    }

    // Para enviar, precisamos saber pra QUEM. Se já temos conversaId, usamos o outroId
    // inferido das mensagens. Se ainda não, usamos o outroId que veio da rota /com/:outroId.
    const destino = estado.outroId;
    if (!destino) {
      erroEnvio.appendChild(bannerErro(
        'Não foi possível identificar o destinatário desta conversa.'
      ));
      return;
    }

    btn.disabled = true;
    input.disabled = true;
    const textoAnterior = btn.textContent;
    btn.textContent = 'Enviando...';

    try {
      const resp = await enviarMensagem(destino, { conteudo });

      // Se era pré-rascunho: precisamos converter pra conversa "real"
      const novoConversaId = resp?.conversa_id;
      if (!estado.conversaId && novoConversaId) {
        estado.conversaId = novoConversaId;
        // Anexa a mensagem que acabou de ser enviada
        if (resp?.mensagem) {
          // Backend devolve {id, tipo, conteudo, created_at} (sem remetente_id explícito).
          // Como acabamos de mandar, sabemos que somos nós.
          estado.mensagens.push({
            ...resp.mensagem,
            remetente_id: estado.user.id,
            snapshot_json: null,
            carrinho_id: null,
          });
          estado.serverTime = resp.mensagem.created_at || estado.serverTime;
        }
        // Limpa o estado vazio e desenha
        redesenharMensagens(estado, listaWrap);
        scrollFim(listaWrap);
        input.value = '';

        // Replace URL pra rota canônica (sem disparar render duplo: usamos history.replaceState
        // mas o nosso router.replace re-resolve. Para evitar desmontar a página, mexemos
        // direto no history.replaceState.)
        const novoHash = `#/conversas/${novoConversaId}`;
        if (location.hash !== novoHash) {
          history.replaceState(null, '', location.pathname + location.search + novoHash);
        }
        // Agora liga o polling
        iniciarPolling(estado, listaWrap);
      } else {
        // Conversa já existia: anexa a mensagem retornada (o polling pegaria de qualquer
        // forma em até 3s, mas ecoar imediatamente dá feedback responsivo)
        if (resp?.mensagem) {
          estado.mensagens.push({
            ...resp.mensagem,
            remetente_id: estado.user.id,
            snapshot_json: null,
            carrinho_id: null,
          });
          estado.serverTime = resp.mensagem.created_at || estado.serverTime;
        }
        redesenharMensagens(estado, listaWrap);
        scrollFim(listaWrap);
        input.value = '';
      }
    } catch (err) {
      erroEnvio.appendChild(bannerErro(err));
    } finally {
      btn.disabled = false;
      input.disabled = false;
      btn.textContent = textoAnterior;
      input.focus();
    }
  });

  return form;
}

// ===================================================================
// Polling
// ===================================================================
function iniciarPolling(estado, listaWrap) {
  if (estado.pollTimer) return; // idempotente

  const tick = async () => {
    if (estado.desmontado || !estado.conversaId) return;
    try {
      const resp = await listarMensagens(estado.conversaId, { since: estado.serverTime });
      const novas = resp?.mensagens || [];
      if (novas.length > 0) {
        // dedup defensivo: filtra ids já presentes (caso o backend repita por arredondamento de timestamp)
        const idsExistentes = new Set(estado.mensagens.map((m) => m.id));
        for (const m of novas) {
          if (!idsExistentes.has(m.id)) {
            estado.mensagens.push(m);
            idsExistentes.add(m.id);

            // se até agora não sabíamos o outroId, agora dá pra inferir
            if (!estado.outroId && Number(m.remetente_id) !== Number(estado.user.id)) {
              estado.outroId = Number(m.remetente_id);
            }
          }
        }
        if (resp.server_time) estado.serverTime = resp.server_time;
        redesenharMensagens(estado, listaWrap);
        scrollFim(listaWrap);
      } else if (resp?.server_time) {
        estado.serverTime = resp.server_time;
      }
    } catch (err) {
      // Falhas de polling não são fatais — silenciamos no console.
      // 401 já é tratado globalmente pelo api.js (auth:expired).
      console.warn('[conversa] polling falhou:', err);
    }
  };

  estado.pollTimer = setInterval(tick, POLL_MS);
}

function pararPolling(estado) {
  if (estado.pollTimer) {
    clearInterval(estado.pollTimer);
    estado.pollTimer = null;
  }
}

// ===================================================================
// Teardown — para o polling ao sair da página
// ===================================================================
function configurarTeardown(estado, outlet) {
  const desmontar = () => {
    if (estado.desmontado) return;
    estado.desmontado = true;
    pararPolling(estado);
    if (estado.observer) {
      estado.observer.disconnect();
      estado.observer = null;
    }
    if (estado.hashListener) {
      window.removeEventListener('hashchange', estado.hashListener);
      estado.hashListener = null;
    }
  };

  // 1) hashchange — qualquer navegação pra outra rota desmonta.
  //    Observação: history.replaceState do próprio form (no caso pré-rascunho)
  //    NÃO dispara hashchange, então o polling sobrevive a essa transição.
  estado.hashListener = () => desmontar();
  window.addEventListener('hashchange', estado.hashListener, { once: true });

  // 2) outlet esvaziado pelo router (defensivo)
  estado.observer = new MutationObserver(() => {
    // se o root da conversa sumir do outlet, desmontamos
    if (!outlet.querySelector('.conversa-root')) {
      desmontar();
    }
  });
  estado.observer.observe(outlet, { childList: true });

  // 3) visibilidade — decisão de projeto: polling continua rodando em 3s sempre,
  //    independente de aba ativa. Não registramos listener pra não criar lixo.
}
