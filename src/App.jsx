import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { db, loadUmbrellas } from "./firebase";
import Auth from "./Auth";

const firebaseConfig = {
  apiKey: "AIzaSyBoqlln2_CAeDGiZsi0Zlqgk0UqmijmCIQ",
  authDomain: "lido-public.firebaseapp.com",
  projectId: "lido-public",
  storageBucket: "lido-public.firebasestorage.app",
  messagingSenderId: "432718465597",
  appId: "1:432718465597:web:b7bad0ed737ae6e74f7854"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const STATUS_COLORS = {
  libero:    { bg:"#e8f5e9", border:"#28a745", text:"Libero",  dot:"#28a745" },
  occupato:  { bg:"#fde8e8", border:"#dc3545", text:"Occupato", dot:"#dc3545" },
  prenotato: { bg:"#fff3cd", border:"#ffc107", text:"Prenotato", dot:"#ffc107" },
  pagato:    { bg:"#cce5ff", border:"#0d6efd", text:"Pagato",  dot:"#0d6efd" },
  pagato_pos:{ bg:"#e8d5f5", border:"#7b2d8b", text:"Pagato POS", dot:"#7b2d8b" },
};

const todayStr = () => new Date().toISOString().slice(0,10);

function dateInRange(date, dal, al) {
  return date >= dal && date <= al;
}

function getPrenForDate(u, date) {
  return (u.prenotazioni||[]).find(p =>
    p._single ? p.dal === date : dateInRange(date, p.dal, p.al)
  );
}

function isoLabel(iso) {
  if (!iso) return "";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [umbrellas, setUmbrellas] = useState([]);
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(8);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedUmb, setSelectedUmb] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (user) {
      loadUmbrellas(db).then(data => {
        if (data.umbrellas.length) setUmbrellas(data.umbrellas);
        if (data.rows) setRows(data.rows);
        if (data.cols) setCols(data.cols);
      });
    }
  }, [user]);

  if (loading) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0d3b6e,#1a5c9a)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#fff",fontSize:20}}>⛱️ Caricamento...</div>
    </div>
  );

  if (!user) return <Auth app={app} onLogin={()=>{}} />;

  const viewDate = selectedDate || todayStr();

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0d3b6e,#1a5c9a)",fontFamily:"Georgia,serif"}}>
      {/* Header */}
      <div style={{background:"rgba(0,0,0,0.2)",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{color:"#fff",fontWeight:"bold",fontSize:18}}>⛱️ Lido Vigna di Valle</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{color:"rgba(255,255,255,0.7)",fontSize:12}}>{user.email}</span>
          <button onClick={()=>signOut(auth)} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:8,color:"#fff",padding:"6px 12px",cursor:"pointer",fontSize:12}}>Esci</button>
        </div>
      </div>

      {/* Selettore data */}
      <div style={{padding:"16px 20px"}}>
        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
          <span style={{color:"#fff",fontSize:13}}>📅 Data:</span>
          <input type="date" value={selectedDate} min={todayStr()} onChange={e=>setSelectedDate(e.target.value)}
            style={{background:"rgba(255,255,255,0.9)",border:"none",borderRadius:8,padding:"6px 10px",fontSize:14,fontFamily:"inherit"}}/>
        </div>
      </div>

      {/* Legenda */}
      <div style={{padding:"0 20px 12px",display:"flex",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"rgba(255,255,255,0.7)"}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:"#28a745"}}/> Disponibile
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"rgba(255,255,255,0.7)"}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:"#dc3545"}}/> Occupato
        </div>
      </div>

      {/* Griglia ombrelloni */}
      <div style={{padding:"0 16px",overflowX:"auto"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:8,fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:2,textTransform:"uppercase"}}>
          <span>🌊 Fronte Mare</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:6,minWidth:cols*70}}>
          {umbrellas.map(u => {
            const id = u.id;
            const pren = getPrenForDate(u, viewDate);
            const isOccupato = !!pren;
            const lettera = String.fromCharCode(65+Math.floor((id-1)/cols));
            const posto = ((id-1)%cols)+1;
            return (
              <div key={id} onClick={()=>{ if(!isOccupato) setSelectedUmb(u); }}
                style={{background:isOccupato?"#fde8e8":"#e8f5e9",border:`2px solid ${isOccupato?"#dc3545":"#28a745"}`,borderRadius:10,padding:"8px 4px",textAlign:"center",cursor:isOccupato?"not-allowed":"pointer",opacity:isOccupato?0.7:1,minHeight:60,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:11,fontWeight:"bold",color:isOccupato?"#dc3545":"#1a7a3c"}}>{lettera}{posto}</div>
                <div style={{fontSize:9,color:isOccupato?"#dc3545":"#28a745",marginTop:2}}>{isOccupato?"Occupato":"Libero"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup prenotazione */}
      {selectedUmb && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000}} onClick={()=>setSelectedUmb(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"28px 24px",width:"100%",maxWidth:500}}>
            <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a",marginBottom:4}}>
              ⛱️ Ombrellone {String.fromCharCode(65+Math.floor((selectedUmb.id-1)/cols))}{((selectedUmb.id-1)%cols)+1}
            </div>
            <div style={{fontSize:13,color:"#888",marginBottom:20}}>Fila {Math.ceil(selectedUmb.id/cols)}, Posto {((selectedUmb.id-1)%cols)+1}</div>
            <div style={{fontSize:13,color:"#555",marginBottom:20}}>📅 Data selezionata: <strong>{isoLabel(viewDate)}</strong></div>
            <button style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",fontSize:16,fontWeight:"bold",cursor:"pointer",fontFamily:"inherit"}}>
              💳 Prenota e Paga
            </button>
            <button onClick={()=>setSelectedUmb(null)} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"#f0f0f0",color:"#555",fontSize:14,cursor:"pointer",fontFamily:"inherit",marginTop:8}}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
