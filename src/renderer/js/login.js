const form    = document.getElementById('form-login');
const emailEl = document.getElementById('email');
const passEl  = document.getElementById('password');
const errorEl = document.getElementById('error-msg');
const btn     = document.getElementById('btn-ingresar');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');

  const email    = emailEl.value.trim();
  const password = passEl.value;

  if (!email || !password) {
    mostrarError('Completá el correo y la contraseña.');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Ingresando...';

  const res = await window.api.auth.login(email, password);

  if (!res.ok) {
    mostrarError(res.error || 'Error al iniciar sesión.');
    btn.disabled    = false;
    btn.textContent = 'Ingresar';
  }
  // Si res.ok: main.js cierra esta ventana y abre la principal
});

function mostrarError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}
