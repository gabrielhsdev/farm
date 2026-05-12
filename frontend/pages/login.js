// pages/login.js — RF02 (POST /auth/login)

import { el, limpar, bannerErro } from '../ui.js';
import { authLogin } from '../api.js';
import { setToken, setUser, isAuthenticated, getUser } from '../auth.js';
import { navigate } from '../router.js';

function destinoPos(user) {
  if (user?.role === 'agricultor') return '#/meu-perfil';
  return '#/agricultores';
}

export function renderLogin({ outlet }) {
  limpar(outlet);

  // Se já está logado, manda direto pra área certa.
  if (isAuthenticated()) {
    navigate(destinoPos(getUser()));
    return;
  }

  const form = el('form', { className: 'form', attrs: { novalidate: true } });
  form.appendChild(el('h1', { text: 'Entrar' }));

  const erroSlot = el('div'); // espaço pra banner de erro
  form.appendChild(erroSlot);

  const emailField = el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'Email', attrs: { for: 'email' } }),
      el('input', {
        attrs: { id: 'email', name: 'email', type: 'email', required: true, autocomplete: 'email' },
      }),
    ],
  });
  form.appendChild(emailField);

  const senhaField = el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'Senha', attrs: { for: 'senha' } }),
      el('input', {
        attrs: { id: 'senha', name: 'senha', type: 'password', required: true, autocomplete: 'current-password', minlength: 6 },
      }),
    ],
  });
  form.appendChild(senhaField);

  const submitBtn = el('button', {
    className: 'btn btn-primary btn-block',
    text: 'Entrar',
    attrs: { type: 'submit' },
  });
  form.appendChild(submitBtn);

  const footer = el('div', { className: 'form-footer' });
  footer.appendChild(document.createTextNode('Não tem conta? '));
  footer.appendChild(el('a', { text: 'Cadastre-se', attrs: { href: '#/registro' } }));
  form.appendChild(footer);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    limpar(erroSlot);

    const email = form.elements.email.value.trim();
    const senha = form.elements.senha.value;

    if (!email || !senha) {
      erroSlot.appendChild(bannerErro('Preencha email e senha.'));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';

    try {
      const { token, usuario } = await authLogin(email, senha);
      setToken(token);
      setUser(usuario);
      window.dispatchEvent(new Event('auth:changed'));
      navigate(destinoPos(usuario));
    } catch (err) {
      erroSlot.appendChild(bannerErro(err));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  });

  outlet.appendChild(form);
}
