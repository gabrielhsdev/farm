// pages/registro.js — RF01 (POST /auth/register)

import { el, limpar, bannerErro } from '../ui.js';
import { authRegister } from '../api.js';
import { setToken, setUser, isAuthenticated, getUser } from '../auth.js';
import { navigate } from '../router.js';

function destinoPos(user) {
  if (user?.role === 'agricultor') return '#/meu-perfil';
  return '#/agricultores';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function renderRegistro({ outlet }) {
  limpar(outlet);

  if (isAuthenticated()) {
    navigate(destinoPos(getUser()));
    return;
  }

  const form = el('form', { className: 'form', attrs: { novalidate: true } });
  form.appendChild(el('h1', { text: 'Criar conta' }));

  const erroSlot = el('div');
  form.appendChild(erroSlot);

  // Nome
  form.appendChild(el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'Nome', attrs: { for: 'nome' } }),
      el('input', {
        attrs: { id: 'nome', name: 'nome', type: 'text', required: true, autocomplete: 'name' },
      }),
    ],
  }));

  // Email
  form.appendChild(el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'Email', attrs: { for: 'email' } }),
      el('input', {
        attrs: { id: 'email', name: 'email', type: 'email', required: true, autocomplete: 'email' },
      }),
    ],
  }));

  // Senha
  form.appendChild(el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'Senha', attrs: { for: 'senha' } }),
      el('input', {
        attrs: { id: 'senha', name: 'senha', type: 'password', required: true, autocomplete: 'new-password', minlength: 6 },
      }),
      el('span', { className: 'form-help', text: 'Mínimo de 6 caracteres.' }),
    ],
  }));

  // Telefone (opcional)
  form.appendChild(el('div', {
    className: 'form-field',
    children: [
      el('label', { text: 'Telefone (opcional)', attrs: { for: 'telefone' } }),
      el('input', {
        attrs: { id: 'telefone', name: 'telefone', type: 'tel', autocomplete: 'tel' },
      }),
    ],
  }));

  // Role — radio cliente / agricultor
  const roleField = el('div', { className: 'form-field' });
  roleField.appendChild(el('label', { text: 'Quero me cadastrar como:' }));

  const radioGroup = el('div', { className: 'radio-group' });

  function makeRadioOption(value, label) {
    const opt = el('label', { className: 'radio-option' });
    const input = el('input', {
      attrs: { type: 'radio', name: 'role', value },
    });
    opt.appendChild(input);
    opt.appendChild(document.createTextNode(label));
    input.addEventListener('change', () => {
      radioGroup.querySelectorAll('.radio-option').forEach(o => o.classList.remove('is-selected'));
      if (input.checked) opt.classList.add('is-selected');
    });
    return opt;
  }

  radioGroup.appendChild(makeRadioOption('cliente', 'Cliente — quero comprar'));
  radioGroup.appendChild(makeRadioOption('agricultor', 'Agricultor — quero vender'));
  roleField.appendChild(radioGroup);
  form.appendChild(roleField);

  // Submit
  const submitBtn = el('button', {
    className: 'btn btn-primary btn-block',
    text: 'Criar conta',
    attrs: { type: 'submit' },
  });
  form.appendChild(submitBtn);

  const footer = el('div', { className: 'form-footer' });
  footer.appendChild(document.createTextNode('Já tem conta? '));
  footer.appendChild(el('a', { text: 'Entrar', attrs: { href: '#/login' } }));
  form.appendChild(footer);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    limpar(erroSlot);

    const nome = form.elements.nome.value.trim();
    const email = form.elements.email.value.trim();
    const senha = form.elements.senha.value;
    const telefone = form.elements.telefone.value.trim();
    const roleEl = form.querySelector('input[name="role"]:checked');
    const role = roleEl ? roleEl.value : '';

    if (!nome) { erroSlot.appendChild(bannerErro('Informe seu nome.')); return; }
    if (!EMAIL_RE.test(email)) { erroSlot.appendChild(bannerErro('Email inválido.')); return; }
    if (senha.length < 6) { erroSlot.appendChild(bannerErro('A senha deve ter pelo menos 6 caracteres.')); return; }
    if (!role) { erroSlot.appendChild(bannerErro('Escolha entre cliente ou agricultor.')); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando...';

    try {
      const payload = { nome, email, senha, role };
      if (telefone) payload.telefone = telefone;
      const { token, usuario } = await authRegister(payload);
      setToken(token);
      setUser(usuario);
      window.dispatchEvent(new Event('auth:changed'));
      navigate(destinoPos(usuario));
    } catch (err) {
      erroSlot.appendChild(bannerErro(err));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar conta';
    }
  });

  outlet.appendChild(form);
}
