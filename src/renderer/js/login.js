const form      = document.getElementById('form-login');
const usuarioEl = document.getElementById('usuario');
const passEl    = document.getElementById('password');
const errorEl   = document.getElementById('error-msg');
const btn       = document.getElementById('btn-ingresar');

// Si ya hay sesión activa, ir directo a caja
if (localStorage.getItem('oma_session')) {
  window.api.navegar('caja.html');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');

  const usuario  = usuarioEl.value.trim();
  const password = passEl.value;

  if (!usuario || !password) {
    mostrarError('Completá el usuario y la contraseña.');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Ingresando...';

  const res = await window.api.usuarios.login(usuario, password);

  if (res.ok) {
    localStorage.setItem('oma_session', JSON.stringify(res.user));
    await window.api.navegar('caja.html');
  } else {
    mostrarError(res.error || 'Error al iniciar sesión.');
    btn.disabled    = false;
    btn.textContent = 'Ingresar';
  }
});

function mostrarError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}
