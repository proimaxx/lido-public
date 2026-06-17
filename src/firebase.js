import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// Firebase GESTIONALE - solo lettura griglia
const appGestionale = initializeApp({
  apiKey: "AIzaSyDBjX7gNfUzVgjYqjJb7bjVtSyAoAESdGU",
  projectId: "lido-balneare-2bd05",
  appId: "1:784686090449:web:935e74866626742dc31df0"
}, "gestionale");

// Firebase PUBBLICO - prenotazioni clienti
const appPublico = initializeApp({
  apiKey: "AIzaSyBoqlln2_CAeDGiZsi0Zlqgk0UqmijmCIQ",
  authDomain: "lido-public.firebaseapp.com",
  projectId: "lido-public",
  storageBucket: "lido-public.firebasestorage.app",
  messagingSenderId: "432718465597",
  appId: "1:432718465597:web:b7bad0ed737ae6e74f7854"
}, "publico");

export const dbGestionale = getFirestore(appGestionale);
export const dbPublico = getFirestore(appPublico);
export const db = dbGestionale;

// Carica griglia dal gestionale
export async function loadUmbrellas(db_instance) {
  try {
    const snap = await getDoc(doc(dbGestionale, "lido", "dati"));
    if (snap.exists()) {
      const data = snap.data();
      return {
        umbrellas: data.umbrellas || [],
        rows: data.rows || null,
        cols: data.cols || null,
        nameFontSize: data.nameFontSize || null,
        cellWidth: data.cellWidth || 80,
        disdette: data.disdette || [],
        gruppi: data.gruppi || [],
        cellHeight: data.cellHeight || null
      };
    }
    return { umbrellas:[], rows:null, cols:null, nameFontSize:null, cellHeight:null, cellWidth:80, disdette:[], gruppi:[] };
  } catch(e) {
    return { umbrellas:[], rows:null, cols:null, nameFontSize:null, cellHeight:null, cellWidth:80, disdette:[], gruppi:[] };
  }
}

// Sottoscrizione real-time dal gestionale
export function subscribeUmbrellas(db_instance, callback) {
  return onSnapshot(doc(dbGestionale, "lido", "dati"), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback({
        umbrellas: data.umbrellas || [],
        rows: data.rows || null,
        cols: data.cols || null,
        nameFontSize: data.nameFontSize || null,
        cellWidth: data.cellWidth || 80,
        disdette: data.disdette || [],
        gruppi: data.gruppi || [],
        cellHeight: data.cellHeight || null
      });
    }
  });
}

// Salva prenotazione cliente sul Firebase pubblico
export async function savePrenotazioneCliente(prenotazione) {
  await setDoc(doc(dbPublico, "prenotazioni", prenotazione.id), prenotazione);
}
