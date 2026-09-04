import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyB7x6Za2etRaiwJw7qfHObm8YuM_N2lx8Q',
  authDomain: 'escala-hora-extra.firebaseapp.com',
  projectId: 'escala-hora-extra',
  storageBucket: 'escala-hora-extra.firebasestorage.app',
  messagingSenderId: '55023300607',
  appId: '1:55023300607:web:1629e61b137ce5babc01ca',
  measurementId: 'G-52Y1NDP8XW',
};

// TROQUE pelo e-mail Google que terá permissão de editar.
export const ADMIN_EMAIL = 'andreyluccadantas@gmail.com';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
