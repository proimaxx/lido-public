import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyDBjX7gNfUzVgjYqjJb7bjVtSyAoAESdGU",
  authDomain:        "lido-balneare-2bd05.firebaseapp.com",
  projectId:         "lido-balneare-2bd05",
  storageBucket:     "lido-balneare-2bd05.firebasestorage.app",
  messagingSenderId: "784686090449",
  appId:             "1:784686090449:web:935e74866626742dc31df0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const DOC_REF = (db_instance) => doc(db_instance, "lido", "dati");
let lastSaveTime = 0;

export async function saveUmbrellas(db_instance, umbrellas, rows, cols, nameFontSize, cellHeight, cellWidth, disdette, gruppi) {
  try {
    const clean = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));
    const data = { umbrellas: clean(umbrellas), updatedAt: Date.now() };
    if (rows) data.rows = rows;
    if (cols) data.cols = cols;
    if (nameFontSize) data.nameFontSize = nameFontSize;
    if (cellHeight) data.cellHeight = cellHeight;
    if (disdette && disdette.length) data.disdette = disdette;
    if (gruppi) data.gruppi = gruppi;
    await setDoc(DOC_REF(db_instance), data);
    lastSaveTime = Date.now();
    console.log("Salvato su Firebase!");
    return true;
  } catch (e) {
    console.error("Errore salvataggio:", e);
    return false;
  }
}

export async function loadUmbrellas(db_instance) {
  try {
    const snap = await getDoc(DOC_REF(db_instance));
    if (snap.exists()) {
      const data = snap.data();
      return { umbrellas: data.umbrellas||[], rows: data.rows||null, cols: data.cols||null, nameFontSize: data.nameFontSize||null, cellHeight: data.cellHeight||null, disdette: data.disdette||[], gruppi: data.gruppi||[] };
    }
    return { umbrellas:[], rows:null, cols:null, nameFontSize:null, cellHeight:null, disdette:[], gruppi:[] };
  } catch (e) {
    console.error("Errore caricamento:", e);
    return { umbrellas:[], rows:null, cols:null, nameFontSize:null, cellHeight:null, disdette:[], gruppi:[] };
  }
}

export function subscribeUmbrellas(db_instance, callback) {
  loadUmbrellas(db_instance).then(data => callback(data));
  const interval = setInterval(() => {
    if (Date.now() - lastSaveTime < 10000) return;
    loadUmbrellas(db_instance).then(data => {
      if (data.umbrellas && data.umbrellas.length > 0) callback(data);
    });
  }, 60000);
  return () => clearInterval(interval);
}