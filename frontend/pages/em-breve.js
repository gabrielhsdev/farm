// pages/em-breve.js — placeholder reutilizável para rotas das Fases B/C/D.
//
// Uso: register('#/carrinho/:id', renderEmBreve('B', 'Carrinho'))

import { el, limpar, link } from '../ui.js';

/**
 * Devolve um handler de rota que mostra "Em breve — Fase X".
 * @param {string} fase — 'B', 'C', 'D'...
 * @param {string} [titulo] — nome amigável da feature (opcional)
 */
export function renderEmBreve(fase, titulo) {
  return ({ outlet }) => {
    limpar(outlet);

    const box = el('div', { className: 'em-breve' });
    box.appendChild(el('div', {
      className: 'em-breve-fase',
      text: `Fase ${fase}`,
    }));
    box.appendChild(el('h2', { text: titulo || 'Em breve' }));
    box.appendChild(el('p', {
      text: 'Essa funcionalidade será implementada em uma próxima fase do projeto.',
    }));
    box.appendChild(link('← Voltar para agricultores', '#/agricultores', 'btn btn-secondary'));

    outlet.appendChild(box);
  };
}
