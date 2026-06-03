(function () {
  // Aplicar tema y HUD inmediatamente para evitar flash
  if (localStorage.getItem('oma_theme') === 'light') {
    document.documentElement.classList.add('theme-light');
  }
  var _hud = localStorage.getItem('oma_hud') || 'normal';
  document.documentElement.classList.add('hud-' + _hud);

  // Si ya hay usuarios, esta pantalla no debería mostrarse
  window.api.usuarios.hayUsuarios().then(function (hay) {
    if (hay) window.api.navegar('login.html');
  });

  var panelWelcome  = document.getElementById('panel-welcome');
  var panelRegister = document.getElementById('panel-register');
  var errorEl       = document.getElementById('register-error');
  var fNombre    = document.getElementById('r-nombre');
  var fUsuario   = document.getElementById('r-usuario');
  var fEmail     = document.getElementById('r-email');
  var fPassword  = document.getElementById('r-password');
  var fConfirmar = document.getElementById('r-confirmar');
  var btnCrear   = document.getElementById('btn-crear');

  function mostrarPanel(el) {
    [panelWelcome, panelRegister].forEach(function (p) { p.style.display = 'none'; });
    el.style.display = 'flex';
  }

  function mostrarError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  // Bienvenida → formulario
  document.getElementById('btn-ir-registro').addEventListener('click', function () {
    mostrarPanel(panelRegister);
    setTimeout(function () { fNombre.focus(); }, 50);
  });

  // Bienvenida → login normal
  document.getElementById('btn-ir-login').addEventListener('click', function () {
    window.api.navegar('login.html');
  });

  // Volver a bienvenida
  document.getElementById('btn-back').addEventListener('click', function () {
    errorEl.classList.add('hidden');
    mostrarPanel(panelWelcome);
  });

  // Crear cuenta
  document.getElementById('form-register').addEventListener('submit', async function (e) {
    e.preventDefault();
    errorEl.classList.add('hidden');

    var nombre    = fNombre.value.trim();
    var usuario   = fUsuario.value.trim();
    var email     = fEmail.value.trim() || null;
    var password  = fPassword.value;
    var confirmar = fConfirmar.value;

    if (!nombre || nombre.length < 2) {
      mostrarError('Ingresá tu nombre completo.');
      fNombre.focus();
      return;
    }
    if (!usuario || usuario.length < 3) {
      mostrarError('El usuario debe tener al menos 3 caracteres.');
      fUsuario.focus();
      return;
    }
    if (!/^[a-zA-Z0-9_.\-]+$/.test(usuario)) {
      mostrarError('El usuario solo puede contener letras, números, guiones y puntos.');
      fUsuario.focus();
      return;
    }
    if (!password || password.length < 4) {
      mostrarError('La contraseña debe tener al menos 4 caracteres.');
      fPassword.focus();
      return;
    }
    if (password !== confirmar) {
      mostrarError('Las contraseñas no coinciden.');
      fConfirmar.focus();
      return;
    }

    btnCrear.disabled    = true;
    btnCrear.textContent = 'Creando cuenta...';

    try {
      await window.api.usuarios.crear({ nombre, usuario, email, password, rol: 'admin' });

      // Auto-login con las credenciales recién creadas
      var loginRes = await window.api.usuarios.login(usuario, password);
      if (!loginRes.ok) throw new Error(loginRes.error || 'No se pudo iniciar sesión.');

      localStorage.setItem('oma_session', JSON.stringify(loginRes.user));
      await window.api.navegar('caja.html');

    } catch (err) {
      mostrarError(err.message || 'No se pudo crear la cuenta. Intentá de nuevo.');
      btnCrear.disabled    = false;
      btnCrear.textContent = 'Crear cuenta';
    }
  });
}());
