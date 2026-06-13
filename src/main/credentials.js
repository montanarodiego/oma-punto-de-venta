const path = require('path');
const fs   = require('fs');

function cargar() {
  // Producción: resources/oma-creds.json (extraResources, fuera del ASAR, no en git)
  // Desarrollo: .oma-creds.json en la raíz del proyecto (también gitignoreado)
  const candidatos = [
    process.resourcesPath ? path.join(process.resourcesPath, 'oma-creds.json') : null,
    path.join(__dirname, '..', '..', 'oma-creds.json'),
    path.join(__dirname, '..', '..', '.oma-creds.json'),
  ].filter(Boolean);

  for (const p of candidatos) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (raw && typeof raw === 'object') return raw;
    } catch {}
  }

  // Fallback: variables de entorno (CI/CD o deploy manual)
  return {
    GMAIL_USER:         process.env.GMAIL_USER         || '',
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',
    firebase_email:     process.env.FIREBASE_EMAIL     || '',
    firebase_password:  process.env.FIREBASE_PASSWORD  || '',
  };
}

module.exports = cargar();
