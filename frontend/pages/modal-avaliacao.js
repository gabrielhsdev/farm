// pages/modal-avaliacao.js — Fase D — RF11
//
// Modal de avaliação. Aberto pelo botão "Avaliar agricultor" do detalhe do
// pedido (`pages/pedido-detalhe.js`) e também pelo link "Editar avaliação"
// quando o cliente já avaliou aquele agricultor.
//
// O backend faz UPSERT por par (cliente, agricultor): chamar POST /avaliacoes
// quando já existe avaliação atualiza o registro existente. Documentado em
// README → Decisões da Fase D. NÃO checamos no client antes de enviar — só
// mandamos e tratamos a resposta.
//
// O caller passa:
//   - pedido: objeto do pedido (precisa de `agricultor_id` e `id`).
//             Opcionalmente, `agricultor_nome` no objeto pra usar no header.
//   - avaliacaoExistente (opcional): { nota, comentario } — pra abrir o
//             modal pré-preenchido (caso "Editar avaliação").
//   - onAvaliado(avaliacao): callback chamado em sucesso. Recebe o registro
//             retornado pelo POST.

import { el, limpar, bannerErro, renderEstrelasInterativas } from '../ui.js';
import { criarAvaliacao } from '../api.js';

const COMENT_MAX = 500;

/**
 * Abre o modal de avaliar agricultor.
 * @param {{
 *   pedido: { id:number, agricultor_id:number, agricultor_nome?:string },
 *   avaliacaoExistente?: { nota:number, comentario?:string|null } | null,
 *   onAvaliado: (avaliacao:any) => void,
 * }} opts
 */
export function abrirModalAvaliacao({ pedido, avaliacaoExistente, onAvaliado }) {
  const ehEdicao = !!avaliacaoExistente;
  const titulo = ehEdicao ? 'Editar avaliação' : 'Avaliar agricultor';

  const overlay = el('div', { className: 'modal-overlay' });
  const card = el('div', {
    className: 'modal-card modal-card-avaliacao',
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

  // Texto introdutório (usa textContent via createTextNode pra interpolar nome com segurança)
  const intro = el('p', { className: 'modal-aval-intro' });
  intro.appendChild(document.createTextNode('Como foi sua experiência com '));
  intro.appendChild(el('strong', { text: pedido.agricultor_nome || 'este agricultor' }));
  intro.appendChild(document.createTextNode('?'));
  form.appendChild(intro);

  // Estrelas interativas, centralizadas
  const estrelasWrap = el('div', { className: 'modal-aval-estrelas-wrap' });
  const estrelas = renderEstrelasInterativas({
    inicial: avaliacaoExistente?.nota || 0,
  });
  estrelasWrap.appendChild(estrelas.node);
  form.appendChild(estrelasWrap);

  // Comentário
  const comWrap = el('div', { className: 'form-field' });
  comWrap.appendChild(el('label', {
    text: 'Comentário (opcional)',
    attrs: { for: 'mav-comentario' },
  }));
  const comTextarea = el('textarea', {
    attrs: { id: 'mav-comentario', maxlength: COMENT_MAX, rows: 3 },
  });
  comTextarea.value = avaliacaoExistente?.comentario || '';
  comWrap.appendChild(comTextarea);
  const comContador = el('span', { className: 'form-help form-contador' });
  comWrap.appendChild(comContador);
  function atualizarContador() {
    comContador.textContent = `${comTextarea.value.length} / ${COMENT_MAX}`;
  }
  atualizarContador();
  comTextarea.addEventListener('input', atualizarContador);
  form.appendChild(comWrap);

  // Footer
  const footer = el('div', { className: 'modal-footer' });
  const btnCancelar = el('button', {
    className: 'btn btn-ghost',
    text: 'Cancelar',
    attrs: { type: 'button' },
  });
  const btnEnviar = el('button', {
    className: 'btn btn-primary',
    text: ehEdicao ? 'Salvar avaliação' : 'Enviar avaliação',
    attrs: { type: 'submit' },
  });
  footer.appendChild(btnCancelar);
  footer.appendChild(btnEnviar);
  form.appendChild(footer);

  card.appendChild(form);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Fechar (× / Cancelar / overlay / Esc)
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

  // Foco inicial: primeira estrela (input principal do form)
  setTimeout(() => {
    const primeira = estrelas.node.querySelector('.stars-input-star');
    if (primeira) primeira.focus();
  }, 0);

  // Submit
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    limpar(erroSlot);

    const nota = estrelas.getValor();
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      erroSlot.appendChild(bannerErro('Selecione uma nota de 1 a 5 estrelas.'));
      return;
    }

    const comentario = comTextarea.value.trim() || null;
    if (comentario && comentario.length > COMENT_MAX) {
      erroSlot.appendChild(bannerErro(`Comentário não pode passar de ${COMENT_MAX} caracteres.`));
      return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = ehEdicao ? 'Salvando...' : 'Enviando...';

    try {
      const avaliacao = await criarAvaliacao({
        agricultor_id: pedido.agricultor_id,
        pedido_id: pedido.id,
        nota,
        comentario,
      });
      fechar();
      if (typeof onAvaliado === 'function') onAvaliado(avaliacao);
    } catch (err) {
      erroSlot.appendChild(bannerErro(err));
      btnEnviar.disabled = false;
      btnEnviar.textContent = ehEdicao ? 'Salvar avaliação' : 'Enviar avaliação';
    }
  });
}
