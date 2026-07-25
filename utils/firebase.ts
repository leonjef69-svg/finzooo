import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  // El revisor de tipos resuelve esta librería como si fuera para una
  // computadora normal, no para un celular, así que no "ve" esta función
  // aunque sí existe y funciona correctamente en el celular real.
  // @ts-expect-error — getReactNativePersistence sí existe en la versión para React Native.
  getReactNativePersistence,
} from "@firebase/auth";
import { getFirestore } from "firebase/firestore";
import { encryptedAsyncStorage } from "@/utils/encryptedAsyncStorage";

// Estos valores no son secretos (son las "señas" públicas de tu proyecto,
// no una contraseña) — es normal y seguro que estén aquí en el código.
const firebaseConfig = {
  apiKey: "AIzaSyAjWO4ItRrPKIL1CCeY3woVeGTtIDz703o",
  authDomain: "dotero-2d430.firebaseapp.com",
  projectId: "dotero-2d430",
  storageBucket: "dotero-2d430.firebasestorage.app",
  messagingSenderId: "133168544890",
  appId: "1:133168544890:web:d8f57aedf72f02def4cfc3",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Usamos una versión cifrada del "cajón" de guardado (en vez del cajón
// normal) para que tu sesión iniciada no quede legible en texto plano
// en el celular.
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(encryptedAsyncStorage),
});

export const db = getFirestore(app);
