const form      = document.getElementById('form-login');
const usuarioEl = document.getElementById('usuario');
const passEl    = document.getElementById('password');
const errorEl   = document.getElementById('error-msg');
const btn       = document.getElementById('btn-ingresar');

// Si ya hay sesión activa, ir directo a caja; si no hay usuarios, setup
if (localStorage.getItem('oma_session')) {
  window.api.navegar('caja.html');
} else {
  window.api.usuarios.hayUsuarios().then(function (hay) {
    if (!hay) window.api.navegar('setup.html');
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');
  document.getElementById('reset-ok-msg').classList.add('hidden');

  const usuario  = usuarioEl.value.trim();
  const password = passEl.value;

  if (!usuario || !password) {
    mostrarError(errorEl, 'Completá el usuario y la contraseña.');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Ingresando...';

  const res = await window.api.usuarios.login(usuario, password);

  if (res.ok) {
    localStorage.setItem('oma_session', JSON.stringify(res.user));
    await window.api.navegar('caja.html');
  } else {
    mostrarError(errorEl, res.error || 'Error al iniciar sesión.');
    btn.disabled    = false;
    btn.textContent = 'Ingresar';
  }
});

// ── Recuperación de contraseña ─────────────────────────────────
let resetEmail  = '';
let resetCodigo = '';

const panels = {
  login:  document.getElementById('panel-login'),
  email:  document.getElementById('panel-reset-email'),
  codigo: document.getElementById('panel-reset-codigo'),
  pass:   document.getElementById('panel-reset-pass'),
};

function mostrarPanel(nombre) {
  Object.values(panels).forEach(p => { p.style.display = 'none'; });
  panels[nombre].style.display = 'block';
}

function mostrarError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function ocultarError(el) {
  el.classList.add('hidden');
}

// Abrir flujo de recuperación
document.getElementById('btn-forgot').addEventListener('click', () => {
  ocultarError(errorEl);
  document.getElementById('reset-ok-msg').classList.add('hidden');
  document.getElementById('reset-email').value = '';
  ocultarError(document.getElementById('reset-email-error'));
  resetEmail  = '';
  resetCodigo = '';
  mostrarPanel('email');
  setTimeout(() => document.getElementById('reset-email').focus(), 50);
});

// Volver al login desde email
document.getElementById('btn-back-from-email').addEventListener('click', () => {
  mostrarPanel('login');
});

// Volver al email desde código
document.getElementById('btn-back-from-codigo').addEventListener('click', () => {
  ocultarError(document.getElementById('reset-codigo-error'));
  document.getElementById('reset-codigo').value = '';
  mostrarPanel('email');
});

// Paso 1: enviar código
document.getElementById('btn-enviar-codigo').addEventListener('click', async () => {
  const emailEl  = document.getElementById('reset-email');
  const errorDiv = document.getElementById('reset-email-error');
  const btnEnv   = document.getElementById('btn-enviar-codigo');

  ocultarError(errorDiv);
  const email = emailEl.value.trim();
  if (!email || !email.includes('@')) {
    mostrarError(errorDiv, 'Ingresá un email válido.');
    return;
  }

  btnEnv.disabled    = true;
  btnEnv.textContent = 'Enviando...';

  const res = await window.api.auth.solicitarReset(email);

  btnEnv.disabled    = false;
  btnEnv.textContent = 'Enviar código';

  if (!res.ok) {
    mostrarError(errorDiv, 'Error al procesar la solicitud. Intentá de nuevo.');
    return;
  }

  // Siempre avanzar — no revelar si el email existe
  resetEmail = email;
  document.getElementById('reset-codigo-hint').textContent =
    'Te enviamos un código a ' + email + ' si está registrado en el sistema.';
  document.getElementById('reset-codigo').value = '';
  ocultarError(document.getElementById('reset-codigo-error'));
  mostrarPanel('codigo');
  setTimeout(() => document.getElementById('reset-codigo').focus(), 50);
});

// Solo números en el input del código
document.getElementById('reset-codigo').addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').slice(0, 6);
});

// Paso 2: verificar código
document.getElementById('btn-verificar-codigo').addEventListener('click', async () => {
  const codigoEl  = document.getElementById('reset-codigo');
  const errorDiv  = document.getElementById('reset-codigo-error');
  const btnVerif  = document.getElementById('btn-verificar-codigo');

  ocultarError(errorDiv);
  const codigo = codigoEl.value.trim();
  if (codigo.length !== 6) {
    mostrarError(errorDiv, 'El código debe tener 6 dígitos.');
    return;
  }

  btnVerif.disabled    = true;
  btnVerif.textContent = 'Verificando...';

  const res = await window.api.auth.verificarCodigo(resetEmail, codigo);

  btnVerif.disabled    = false;
  btnVerif.textContent = 'Verificar código';

  if (!res.ok) {
    mostrarError(errorDiv, 'Código incorrecto o vencido. Revisá el email o solicitá uno nuevo.');
    return;
  }

  resetCodigo = codigo;
  document.getElementById('reset-nueva-pass').value    = '';
  document.getElementById('reset-confirmar-pass').value = '';
  ocultarError(document.getElementById('reset-pass-error'));
  mostrarPanel('pass');
  setTimeout(() => document.getElementById('reset-nueva-pass').focus(), 50);
});

// Paso 3: cambiar contraseña
document.getElementById('btn-cambiar-pass').addEventListener('click', async () => {
  const nuevaEl    = document.getElementById('reset-nueva-pass');
  const confirmaEl = document.getElementById('reset-confirmar-pass');
  const errorDiv   = document.getElementById('reset-pass-error');
  const btnCambiar = document.getElementById('btn-cambiar-pass');

  ocultarError(errorDiv);
  const nueva    = nuevaEl.value;
  const confirma = confirmaEl.value;

  if (!nueva || nueva.length < 4) {
    mostrarError(errorDiv, 'La contraseña debe tener al menos 4 caracteres.');
    return;
  }
  if (nueva !== confirma) {
    mostrarError(errorDiv, 'Las contraseñas no coinciden.');
    return;
  }

  btnCambiar.disabled    = true;
  btnCambiar.textContent = 'Guardando...';

  const res = await window.api.auth.resetearPassword(resetEmail, resetCodigo, nueva);

  btnCambiar.disabled    = false;
  btnCambiar.textContent = 'Cambiar contraseña';

  if (!res.ok) {
    mostrarError(errorDiv, 'No se pudo cambiar la contraseña. El código puede haber vencido.');
    return;
  }

  // Éxito: volver al login con mensaje
  resetEmail  = '';
  resetCodigo = '';
  mostrarPanel('login');
  usuarioEl.value = '';
  passEl.value    = '';
  const okEl = document.getElementById('reset-ok-msg');
  okEl.textContent = 'Contraseña actualizada correctamente. Ya podés ingresar.';
  okEl.classList.remove('hidden');
  setTimeout(() => usuarioEl.focus(), 50);
});
