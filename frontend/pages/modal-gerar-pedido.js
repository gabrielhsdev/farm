// pages/modal-gerar-pedido.js — Fase D — RF13
//
// Modal sobreposto, aberto pelo botão "Gerar pedido" da bolha de snapshot
// no chat (`pages/conversa.js`). Mesmo padrão do modal de produto da Fase C:
// overlay + card + header + form + footer; fecha por ×, Cancelar, click no
// overlay e Esc; foco automático no primeiro select.
//
// O caller passa:
//   - mensagemSnapshotId: id da mensagem `tipo='snapshot'` que dispara o pedido
//   - snapshotJson: objeto `{ itens:[...], total }` da mensagem (já presente
//                   no DOM, evita refetch)
//   - onCriado(pedido): callback chamado em sucesso. Recebe o pedido cru
//                       devolvido por POST /pedidos. Decisão de navegação
//                       e toast fica com quem chamou.
//
// Edge cases conhecidos do backend (mensagens já vêm traduzidas pelo api.js,
// só repassamos via bannerErro):
//   - 400 SNAPSHOT_USADO       → "este snapshot já gerou um pedido"
//   - 400 ESTOQUE_INSUFICIENTE → "estoque insuficiente para X (disp: N, ped: M)"

import { el, limpar, bannerErro, formatarMoeda } from '../ui.js';
import { listarFormasPagamento, criarPedido } from '../api.js';

const OBS_MAX = 500;
const SNAPSHOT_ITENS_VISIVEIS = 5; // mesmo limite da bolha do chat

// Cache em memória de formas de pagamento — populado na primeira abertura
// e reusado entre re-aberturas. Equivalente ao `categoriasCache` da Fase C.
let formasPagamentoCache = null;

/**
 * Abre o modal de criação de pedido.
 * @param {{
 *   mensagemSnapshotId: number,
 *   snapshotJson: { itens: Array<{nome?:string, quantidade:number, preco_unit:number, subtotal?:number}>, total:number },
 *   onCriado: (pedido:any) => void,
 * }} opts
 */
export function abrirModalGerarPedido({ mensagemSnapshotId, snapshotJson, onCriado }) {
  const titulo = 'Gerar pedido a partir do carrinho recebido';

  const overlay = el('div', { className: 'modal-overlay' });
  const card = el('div', {
    className: 'modal-card',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
  });

  // Header
  const header = el('div', { className: 'modal-header' });
  header.appendChild(el('h2', { className: 'modal-title', text: titulo }));
  const btnClose = el('button', {
    className: 'btn btn-ghost modal-close',
    text: '×',
    attrs: { type: 'button', 'aria-label': 'Fechar' },
  });
  header.appendChild(btnClose);
  card.appendChild(header);

  // Form
  const form = el('form', { className: 'modal-form', attrs: { novalidate: true } });

  const erroSlot = el('div');
  form.appendChild(erroSlot);

  // ---------- Resumo do snapshot (read-only) ----------
  form.appendChild(renderResumoSnapshot(snapshotJson));

  // ---------- Forma de pagamento ----------
  const fpWrap = el('div', { className: 'form-field' });
  fpWrap.appendChild(el('label', {
    text: 'Forma de pagamento',
    attrs: { for: 'mgp-forma-pagamento' },
  }));
  const fpSelect = el('select', {
    attrs: { id: 'mgp-forma-pagamento', required: true },
  });
  fpSelect.appendChild(el('option', { text: 'Carregando...', attrs: { value: '' } }));
  fpSelect.disabled = true;
  fpWrap.appendChild(fpSelect);
  form.appendChild(fpWrap);

  // ---------- Data de retirada (opcional) ----------
  const dataWrap = el('div', { className: 'form-field' });
  dataWrap.appendChild(el('label', {
    text: 'Data de retirada (opcional)',
    attrs: { for: 'mgp-data-retirada' },
  }));
  const dataInput = el('input', {
    attrs: { id: 'mgp-data-retirada', type: 'datetime-local' },
  });
  dataWrap.appendChild(dataInput);
  dataWrap.appendChild(el('span', {
    className: 'form-help',
    text: 'Deixe em branco se ainda não foi combinada.',
  }));
  form.appendChild(dataWrap);

  // ---------- Observações ----------
  const obsWrap = el('div', { className: 'form-field' });
  obsWrap.appendChild(el('label', {
    text: 'Observações (opcional)',
    attrs: { for: 'mgp-observacoes' },
  }));
  const obsTextarea = el('textarea', {
    attrs: { id: 'mgp-observacoes', maxlength: OBS_MAX, rows: 3 },
  });
  obsWrap.appendChild(obsTextarea);
  const obsContador = el('span', { className: 'form-help form-contador' });
  obsWrap.appendChild(obsContador);
  function atualizarContadorObs() {
    obsContador.textContent = `${obsTextarea.value.length} / ${OBS_MAX}`;
  }
  atualizarContadorObs();
  obsTextarea.addEventListener('input', atualizarContadorObs);
  form.appendChild(obsWrap);

  // ---------- Footer ----------
  const footer = el('div', { className: 'modal-footer' });
  const btnCancelar = el('button', {
    className: 'btn btn-ghost',
    text: 'Cancelar',
    attrs: { type: 'button' },
  });
  const btnConfirmar = el('button', {
    className: 'btn btn-primary',
    text: 'Confirmar pedido',
    attrs: { type: 'submit' },
  });
  footer.appendChild(btnCancelar);
  footer.appendChild(btnConfirmar);
  form.appendChild(footer);

  card.appendChild(form);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // ---------- Fechar (× / Cancelar / overlay / Esc) ----------
  function fechar() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', escListener);
    document.body.classList.remove('modal-aberto');
  }
  function escListener(ev) {
    if (ev.key === 'Escape') fechar();
  }
  btnClose.addEventListener('click', fechar);
  btnCancelar.addEventListener('click', fechar);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) fechar();
  });
  document.addEventListener('keydown', escListener);
  document.body.classList.add('modal-aberto');

  // ---------- Carregar formas de pagamento (com cache) ----------
  (async () => {
    try {
      const formas = formasPagamentoCache
        ? formasPagamentoCache
        : await listarFormasPagamento();
      if (!formasPagamentoCache) formasPagamentoCache = formas || [];

      // Repopula o select agora que temos os dados
      limpar(fpSelect);
      fpSelect.appendChild(el('option', {
        text: '— selecione —',
        attrs: { value: '' },
      }));
      for (const f of formasPagamentoCache) {
        fpSelect.appendChild(el('option', {
          text: f.nome,
          attrs: { value: String(f.id) },
        }));
      }
      fpSelect.disabled = false;

      // Foco no primeiro select (após o carregamento, para que o foco caia
      // num campo já interativo).
      setTimeout(() => fpSelect.focus(), 0);
    } catch (err) {
      erroSlot.appendChild(bannerErro(err));
      // Mantém o select desabilitado — o usuário ainda pode fechar.
    }
  })();

  // ---------- Submit ----------
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    limpar(erroSlot);

    const forma_pagamento_id = parseInt(fpSelect.value, 10);
    if (!Number.isInteger(forma_pagamento_id) || forma_pagamento_id <= 0) {
      erroSlot.appendChild(bannerErro('Selecione uma forma de pagamento.'));
      return;
    }

    // Data: datetime-local devolve "2026-05-08T09:00" (sem timezone). Converter
    // pra ISO via Date (interpretado no fuso local) — o backend só guarda a string.
    let data_retirada = null;
    if (dataInput.value) {
      const d = new Date(dataInput.value);
      if (Number.isNaN(d.getTime())) {
        erroSlot.appendChild(bannerErro('Data de retirada inválida.'));
        return;
      }
      data_retirada = d.toISOString();
    }

    const observacoes = obsTextarea.value.trim() || null;
    if (observacoes && observacoes.length > OBS_MAX) {
      erroSlot.appendChild(bannerErro(`Observações não podem passar de ${OBS_MAX} caracteres.`));
      return;
    }

    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Criando pedido...';

    try {
      const pedido = await criarPedido({
        mensagem_snapshot_id: mensagemSnapshotId,
        forma_pagamento_id,
        data_retirada,
        observacoes,
      });
      fechar();
      if (typeof onCriado === 'function') onCriado(pedido);
    } catch (err) {
      erroSlot.appendChild(bannerErro(err));
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = 'Confirmar pedido';
    }
  });
}

// =============================================================
// Helpers
// =============================================================

/**
 * Render do resumo do snapshot dentro do modal. Mesma estrutura visual da
 * bolha de chat, mas em tom mais discreto (read-only, dentro de form).
 */
function renderResumoSnapshot(snap) {
  const wrap = el('div', { className: 'modal-snap-resumo' });

  wrap.appendChild(el('p', {
    className: 'modal-snap-titulo',
    text: 'Itens do carrinho',
  }));

  const itens = Array.isArray(snap?.itens) ? snap.itens : [];
  if (itens.length === 0) {
    wrap.appendChild(el('p', {
      className: 'form-help',
      text: 'Este snapshot não tem itens — possivelmente inválido.',
    }));
    return wrap;
  }

  const lista = el('ul', { className: 'modal-snap-itens' });
  const visiveis = itens.slice(0, SNAPSHOT_ITENS_VISIVEIS);
  for (const it of visiveis) {
    const subtotal = (it.subtotal != null)
      ? Number(it.subtotal)
      : (Number(it.preco_unit || 0) * Number(it.quantidade || 0));
    const li = el('li', { className: 'modal-snap-item' });
    li.appendChild(el('span', {
      className: 'modal-snap-item-nome',
      text: `${formatarQtd(it.quantidade)} × ${it.nome || 'Produto'}`,
    }));
    li.appendChild(el('span', {
      className: 'modal-snap-item-valor',
      text: formatarMoeda(subtotal),
    }));
    lista.appendChild(li);
  }
  if (itens.length > SNAPSHOT_ITENS_VISIVEIS) {
    const restante = itens.length - SNAPSHOT_ITENS_VISIVEIS;
    lista.appendChild(el('li', {
      className: 'modal-snap-item modal-snap-item-extra',
      text: `+ ${restante} ite${restante === 1 ? 'm' : 'ns'}`,
    }));
  }
  wrap.appendChild(lista);

  const totalBox = el('div', { className: 'modal-snap-total' });
  totalBox.appendChild(el('span', { text: 'Total' }));
  totalBox.appendChild(el('strong', { text: formatarMoeda(snap?.total || 0) }));
  wrap.appendChild(totalBox);

  return wrap;
}

function formatarQtd(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return '?';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace('.', ',');
}
