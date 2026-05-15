// Firebase — configuración e inicialización para el proceso principal (Node.js)
//
// Estructura esperada en Firestore:
//   negocios/
//     {negocioId}/                   ← documento: { licencia: { activa, vencimiento } }
//       articulos/  {id}             ← subcolección
//       transacciones/ {id}          ← subcolección
//       clientes/   {id}             ← subcolección

const { initializeApp }                      = require('firebase/app');
const { initializeAuth, inMemoryPersistence } = require('firebase/auth');
const { getFirestore }                        = require('firebase/firestore');

const firebaseConfig = {
  apiKey:            'AIzaSyCxQCZfo9rfzjNwvRK9h_2GzC0TS_ZeTGU',
  authDomain:        'omatechpos.firebaseapp.com',
  projectId:         'omatechpos',
  storageBucket:     'omatechpos.firebasestorage.app',
  messagingSenderId: '1045506785688',
  appId:             '1:1045506785688:web:055db8db7552f797702bed',
};

const firebaseApp = initializeApp(firebaseConfig);

// inMemoryPersistence evita errores de localStorage en el proceso Node de Electron
const auth      = initializeAuth(firebaseApp, { persistence: inMemoryPersistence });
const firestore = getFirestore(firebaseApp);

module.exports = { firebaseApp, auth, firestore };
