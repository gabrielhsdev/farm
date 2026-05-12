// auth.js — helpers de sessão em localStorage.
// O backend usa JWT stateless: o token é guardado aqui e injetado pelo api.js
// via header Authorization. Em 401, main.js dispara logout() e redireciona.

const TOKEN_KEY = 'roca:token';
const USER_KEY = 'roca:user';

/** Recupera o JWT atual, ou null se deslogado. */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Grava o JWT (após login/registro bem-sucedido). */
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Recupera o objeto do usuário logado: { id, nome, email, role, ... } ou null. */
export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Grava o objeto do usuário (após login/registro). */
export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

/** True se há token + usuário em localStorage. */
export function isAuthenticated() {
  return !!(getToken() && getUser());
}

/** Limpa sessão. Não navega — quem chama decide para onde redirecionar. */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
