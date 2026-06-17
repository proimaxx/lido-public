import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBoqlln2_CAeDGiZsi0Zlqgk0UqmijmCIQ",
  authDomain: "lido-public.firebaseapp.com",
  projectId: "lido-public",
  storageBucket: "lido-public.firebasestorage.app",
  messagingSenderId: "432718465597",
  appId: "1:432718465597:web:b7bad0ed737ae6e74f7854"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

export async function saveUmbrellas(db_instance, umbrellas, rows, cols, nameFontSize, cellHeight, cellWidth, disdette, gruppi) {
  const clean = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));
  const data = { umbrellas: clean(umbrellas), updatedAt: Date.now() };
  if (rows) data.rows = rows;
  if (cols) data.cols = cols;
  if (nameFontSize) data.nameFontSize = nameFontSize;
  if (cellHeight) data.cellHeight = cellHeight;
  if (cellWidth) data.cellWidth = cellWidth;
  if (disdette && disdette.length) data.disdette = disdette;
  if (gruppi) data.gruppi = gruppi;
  await setDoc(doc(db_instance, "lido", "dati"), data, { merge: true });
}

export async function loadUmbrellas(db_instance) {
  try {
    const snap = await getDoc(doc(db_instance, "lido", "dati"));
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

export function subscribeUmbrellas(db_instance, callback) {
  const { onSnapshot, doc } = require("firebase/firestore");
  return onSnapshot(doc(db_instance, "lido", "dati"), (snap) => {
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
