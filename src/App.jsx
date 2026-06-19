import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { db, loadUmbrellas, subscribeUmbrellas, savePrenotazioneCliente, loadProfiloUtente, salvaProfiloUtente, loadRichiesteInAttesa, subscribeRichiesteInAttesa } from "./firebase";
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
  const [dataFine, setDataFine] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [prenotazioneOk, setPrenotazioneOk] = useState(false);
  const [lettinoExtra, setLettinoExtra] = useState(false);
  const [noteCliente, setNoteCliente] = useState("");
  const [portaAnimale, setPortaAnimale] = useState(false);
  const [tagliaAnimale, setTagliaAnimale] = useState("");
  const [showAvvisoAnimale, setShowAvvisoAnimale] = useState(false);
  const [filtraAnimali, setFiltraAnimali] = useState(false);
  const [disponibilita, setDisponibilita] = useState({giorni_bloccati:[],ombrelloni_bloccati:[],stagione:{dal:"",al:""}});
  const [profilo, setProfilo] = useState(null);
  const [richiesteInAttesa, setRichiesteInAttesa] = useState([]);
  const [showProfilo, setShowProfilo] = useState(false);
  const [editProfilo, setEditProfilo] = useState({nome:"",cognome:"",telefono:""});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (user) {
      const unsubGrid = subscribeUmbrellas(db, data => {
        if (data.umbrellas.length) setUmbrellas(data.umbrellas);
        if (data.rows) setRows(data.rows);
        if (data.cols) setCols(data.cols);
        if (data.disponibilita) setDisponibilita(data.disponibilita);
      });
      // Carica profilo utente
      // Carica richieste in attesa per bloccare celle
      loadRichiesteInAttesa().then(setRichiesteInAttesa).catch(()=>{});
      loadProfiloUtente(user.uid).then(profSnap=>{
        if (profSnap) { setProfilo(profSnap); } else { setShowProfilo(true); }
      }).catch(()=>{});
      return () => unsubGrid();
    }
  }, [user]);

  // Sottoscrizione real-time alle richieste in attesa + notifica su nuove prenotazioni
  const richiesteIdsPrecedenti = useRef(null);
  useEffect(()=>{
    if(!user) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const unsub = subscribeRichiesteInAttesa((richieste)=>{
      const idsAttuali = new Set(richieste.map(r=>r.id));
      if (richiesteIdsPrecedenti.current !== null) {
        const nuove = richieste.filter(r => !richiesteIdsPrecedenti.current.has(r.id));
        if (nuove.length > 0) {
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
            audio.play().catch(()=>{});
          } catch(e) {}
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            nuove.forEach(r=>{
              new Notification("Nuova prenotazione online", {
                body: `${r.nome || "Cliente"} - Ombrellone ${r.umbId || "?"} - ${r.dal || ""}`,
                icon: "/favicon.ico"
              });
            });
          }
        }
      }
      richiesteIdsPrecedenti.current = idsAttuali;
      setRichiesteInAttesa(richieste);
    });
    return ()=>unsub();
  }, [user]);

  if (loading) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0d3b6e,#1a5c9a)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#fff",fontSize:20}}>⛱️ Caricamento...</div>
    </div>
  );

  if (!user) return <Auth app={app} onLogin={()=>{}} />;

  const viewDate = selectedDate || todayStr();

  // Calcola prezzo totale prenotazione
  const calcolaPrezzo = (umbId, dal, al, lettino) => {
    if (!dal) return 0;
    const fine = al || dal;
    const tariffe = disponibilita.tariffe || {};
    const tariffeFila = tariffe.file || [];
    const cols2 = cols || 8;
    const lett = String.fromCharCode(65+Math.floor((umbId-1)/cols2));
    const tariffa = tariffeFila.find(f=>f.fila===lett) || {feriale:0, weekend:0};
    let totale = 0;
    let data = new Date(dal+"T00:00:00");
    const dataFine2 = new Date(fine+"T00:00:00");
    while (data <= dataFine2) {
      const giorno = data.getDay();
      const isWeekend = giorno===0||giorno===6;
      totale += isWeekend ? (tariffa.weekend||0) : (tariffa.feriale||0);
      if (lettino) totale += (tariffe.lettino_extra||0);
      data.setDate(data.getDate()+1);
    }
    return totale;
  };
  const giornoBloccato = (disponibilita.giorni_bloccati||[]).includes(viewDate);
  const fuoriStagione = disponibilita.stagione?.dal && disponibilita.stagione?.al
    ? viewDate < disponibilita.stagione.dal || viewDate > disponibilita.stagione.al
    : false;
  const giornoDisponibile = !giornoBloccato && !fuoriStagione;

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0d3b6e,#1a5c9a)",fontFamily:"Georgia,serif"}}>
      {/* Header */}
      <div style={{background:"rgba(0,0,0,0.2)",padding:"10px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{color:"#fff",fontWeight:"bold",fontSize:16}}>⛱️ Lido Vigna di Valle</div>
          <span style={{color:"#fff",fontSize:11,fontWeight:"bold"}}>{user.email}</span>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <button onClick={()=>{setEditProfilo({nome:profilo?.nome||"",cognome:profilo?.cognome||"",telefono:profilo?.telefono||""});setShowProfilo(true);}} style={{flex:1,background:"rgba(255,255,255,0.2)",border:"none",borderRadius:8,color:"#fff",padding:"8px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>👤 Profilo</button>
          <button onClick={()=>window.location.reload()} style={{flex:1,background:"rgba(255,255,255,0.2)",border:"none",borderRadius:8,color:"#fff",padding:"8px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>🔄 Aggiorna</button>
          <button onClick={()=>signOut(auth)} style={{flex:1,background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:"#fff",padding:"8px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>↩️ Esci</button>
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

      {/* Banner giorno bloccato */}
      {!giornoDisponibile && (
        <div style={{margin:"0 16px 12px",background:"rgba(220,53,69,0.3)",border:"2px solid #dc3545",borderRadius:12,padding:"10px 16px",textAlign:"center"}}>
          <span style={{color:"#fff",fontWeight:"bold",fontSize:13}}>
            {giornoBloccato?"🚫 Non disponibile per prenotazioni online":"⛱️ Fuori stagione — stabilimento chiuso"}
          </span>
        </div>
      )}
      {/* Orientamento spiaggia */}
      <div style={{margin:"0 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,0.6)"}}>
        <span>⬆️ Fila A = Fronte Lago</span>
        <span>🌊</span>
        <span>Fila {String.fromCharCode(65+rows-1)} = Vicino Strada ⬇️</span>
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
          <span>🌊 Fronte Lago</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:6,minWidth:cols*70}}>
          {umbrellas.map(u => {
            const id = u.id;
            const pren = getPrenForDate(u, viewDate);
            const isOccupato = !!pren;
            const isBloccato = (disponibilita.ombrelloni_bloccati||[]).includes(u.id) || !giornoDisponibile;
            const petFriendly = (disponibilita.postazioni_pet||[]).includes(u.id);
            const nonPetVisible = filtraAnimali && !petFriendly;
            const hasRichiesta = richiesteInAttesa.some(r=>Number(r.umbId)===u.id&&(r.status==="in_attesa"||r.status==="accettata")&&(r._single?r.dal===viewDate:(viewDate>=r.dal&&viewDate<=r.al)));
            const lettera = String.fromCharCode(65+Math.floor((id-1)/cols));
            const posto = ((id-1)%cols)+1;
            return (
              <div key={id} onClick={()=>{ if(!isOccupato && !isBloccato && !hasRichiesta && !nonPetVisible) setSelectedUmb(u); }}
                style={{background:nonPetVisible?"#f0f0f0":isOccupato||isBloccato||hasRichiesta?"#fde8e8":"#e8f5e9",border:`2px solid ${nonPetVisible?"#ccc":isOccupato||isBloccato||hasRichiesta?"#dc3545":"#28a745"}`,borderRadius:10,padding:"8px 4px",textAlign:"center",cursor:nonPetVisible||isOccupato||isBloccato||hasRichiesta?"not-allowed":"pointer",opacity:nonPetVisible||isOccupato||isBloccato||hasRichiesta?0.5:1,minHeight:60,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:11,fontWeight:"bold",color:nonPetVisible?"#aaa":isOccupato?"#dc3545":"#1a7a3c"}}>
                  {lettera}{posto}{petFriendly?"🐕":""}
                </div>
                <div style={{fontSize:9,color:nonPetVisible?"#aaa":isOccupato||isBloccato||hasRichiesta?"#dc3545":"#28a745",marginTop:2}}>{nonPetVisible?"🚫 Cani":isOccupato?"Occupato":isBloccato?"Non disponibile":hasRichiesta?"Richiesta in corso":"Libero"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Profilo */}
      {showProfilo && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#fff",borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:400}}>
            <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a",marginBottom:4}}>👤 Il mio profilo</div>
            <div style={{fontSize:12,color:"#888",marginBottom:20}}>{user.email}</div>
            <input value={editProfilo.nome} onChange={e=>setEditProfilo(p=>({...p,nome:e.target.value.toUpperCase()}))} placeholder="Nome" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #ddd",fontSize:14,fontFamily:"inherit",boxSizing:"border-box",marginBottom:10,textTransform:"uppercase"}}/>
            <input value={editProfilo.cognome} onChange={e=>setEditProfilo(p=>({...p,cognome:e.target.value.toUpperCase()}))} placeholder="Cognome" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #ddd",fontSize:14,fontFamily:"inherit",boxSizing:"border-box",marginBottom:10,textTransform:"uppercase"}}/>
            <input value={editProfilo.telefono} onChange={e=>setEditProfilo(p=>({...p,telefono:e.target.value}))} placeholder="Telefono" type="tel" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #ddd",fontSize:14,fontFamily:"inherit",boxSizing:"border-box",marginBottom:20}}/>
            <button onClick={async()=>{
              try {
                const dati = {...editProfilo, email:user.email, updatedAt:Date.now()};
                await salvaProfiloUtente(user.uid, dati);
                setProfilo(dati);
                setShowProfilo(false);
              } catch(e) { alert("Errore: "+e.message); }
            }} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",fontSize:15,fontWeight:"bold",cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
              💾 Salva profilo
            </button>
            {profilo&&<button onClick={()=>setShowProfilo(false)} style={{width:"100%",padding:"10px",borderRadius:12,border:"none",background:"#f0f0f0",color:"#555",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Annulla</button>}
          </div>
        </div>
      )}

      {/* Strada sotto la griglia */}
      <div style={{margin:"4px 16px 16px"}}>
        {/* Entrata spiaggia */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:-1}}>
          <div style={{background:"repeating-linear-gradient(45deg,#8B6914,#8B6914 4px,#A0802A 4px,#A0802A 8px)",borderRadius:"6px 6px 0 0",padding:"4px 16px",fontSize:8,color:"rgba(255,255,255,0.7)",letterSpacing:1,textTransform:"uppercase",fontWeight:"bold"}}>
            🪜 Scale
          </div>
          <div style={{background:"repeating-linear-gradient(45deg,#8B6914,#8B6914 4px,#A0802A 4px,#A0802A 8px)",borderRadius:"6px 6px 0 0",padding:"4px 16px",fontSize:8,color:"rgba(255,255,255,0.7)",letterSpacing:1,textTransform:"uppercase",fontWeight:"bold"}}>
            🚪 Entrata Spiaggia
          </div>
        </div>
        {/* Pista ciclabile */}
        <div style={{background:"#2d5a1b",padding:"5px 12px",display:"flex",justifyContent:"space-between",borderBottom:"2px dashed #4CAF50"}}>
          <span style={{fontSize:12}}>🚶</span>
          <span style={{fontSize:12}}>🚴</span>
          <span style={{fontSize:12}}>🚶</span>
          <span style={{fontSize:12}}>🚴</span>
          <span style={{fontSize:12}}>🚶</span>
        </div>
        {/* Strada */}
        <div style={{background:"#2a2a2a",padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{flex:1,height:2,background:"repeating-linear-gradient(90deg,#FFD700 0px,#FFD700 20px,transparent 20px,transparent 40px)",opacity:0.6}}/>
          <span style={{margin:"0 8px",fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:2,textTransform:"uppercase"}}>🛣️ Strada</span>
          <div style={{flex:1,height:2,background:"repeating-linear-gradient(90deg,#FFD700 0px,#FFD700 20px,transparent 20px,transparent 40px)",opacity:0.6}}/>
        </div>
        {/* Parcheggio e Bar */}
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <div style={{background:"#d0d0d0",borderRadius:"0 0 6px 6px",padding:"4px 16px",fontSize:8,color:"#333",letterSpacing:1,textTransform:"uppercase",fontWeight:"bold"}}>
            🅿️ Parcheggio
          </div>
          <div style={{background:"#b8e6b8",borderRadius:"0 0 6px 6px",padding:"4px 16px",fontSize:8,color:"#1a5c1a",letterSpacing:1,textTransform:"uppercase",fontWeight:"bold"}}>
            ☕ Bar
          </div>
        </div>
      </div>

      {/* Popup avviso animale */}
      {showAvvisoAnimale && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}} onClick={()=>setShowAvvisoAnimale(false)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:380}}>
            <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a",marginBottom:8}}>🐕 Animali ammessi</div>
            <div style={{fontSize:13,color:"#555",marginBottom:20,lineHeight:1.6}}>
              Le prenotazioni con animali sono disponibili solo in <strong>postazioni designate</strong>.
              Nello stabilimento sono ammessi <strong>esclusivamente animali di piccola taglia</strong>, nel rispetto delle regole previste dalla <strong>normativa comunale</strong> in materia di accesso degli animali in spiaggia.
            </div>
            <button onClick={()=>{setTagliaAnimale("Piccola taglia");setPortaAnimale(true);setFiltraAnimali(true);setShowAvvisoAnimale(false);}}
              style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"none",background:"#fff3cd",color:"#856404",cursor:"pointer",fontFamily:"inherit",fontSize:13,marginBottom:8,fontWeight:"bold"}}>
              🐕 Porto un animale di piccola taglia
            </button>
            <button onClick={()=>{setPortaAnimale(false);setTagliaAnimale("");setFiltraAnimali(false);setShowAvvisoAnimale(false);}}
              style={{width:"100%",padding:"10px",borderRadius:10,border:"none",background:"#f0f0f0",color:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:13,marginTop:4}}>
              Non porto animali
            </button>
          </div>
        </div>
      )}

      {/* Popup prenotazione */}
      {selectedUmb && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000}} onClick={()=>setSelectedUmb(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"28px 24px",width:"100%",maxWidth:500}}>
            {prenotazioneOk ? (
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:40,marginBottom:12}}>🎉</div>
                <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a",marginBottom:8}}>Richiesta inviata!</div>
                <div style={{fontSize:13,color:"#888",marginBottom:20}}>La tua prenotazione è in attesa di conferma. Ti contatteremo presto!</div>
                <button onClick={()=>{setSelectedUmb(null);setPrenotazioneOk(false);setDataFine("");}} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",fontSize:14,fontWeight:"bold",cursor:"pointer",fontFamily:"inherit"}}>
                  Chiudi
                </button>
              </div>
            ) : (
              <>
                <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a",marginBottom:4}}>
                  ⛱️ Ombrellone {String.fromCharCode(65+Math.floor((selectedUmb.id-1)/cols))}{((selectedUmb.id-1)%cols)+1}
                </div>
                <div style={{fontSize:13,color:"#888",marginBottom:16}}>Fila {Math.ceil(selectedUmb.id/cols)}, Posto {((selectedUmb.id-1)%cols)+1}</div>
                {/* Regole postazione */}
                <div style={{background:"#f0f7ff",borderRadius:10,padding:"10px 14px",marginBottom:14,border:"1px solid #cce0ff"}}>
                  <div style={{fontSize:11,fontWeight:"bold",color:"#0d6efd",marginBottom:4}}>📋 Informazioni postazione</div>
                  <div style={{fontSize:11,color:"#555",lineHeight:1.5}}>
                    • Ogni postazione include 1 ombrellone e 2 lettini<br/>
                    • È possibile aggiungere 1 lettino extra<br/>
                    • La postazione è riservata fino alle ore 12:00
                  </div>
                </div>

                <div style={{marginBottom:12}}>
                  <label style={{fontSize:13,color:"#1a2e4a",fontWeight:"bold",display:"block",marginBottom:4}}>📅 Data inizio</label>
                  <input type="date" value={viewDate} readOnly style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #ddd",fontSize:14,fontFamily:"inherit",boxSizing:"border-box",background:"#f8f8f8"}}/>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:13,color:"#1a2e4a",fontWeight:"bold",display:"block",marginBottom:4}}>📅 Data fine (opzionale)</label>
                  <input type="date" value={dataFine} min={viewDate} onChange={e=>setDataFine(e.target.value)} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #ddd",fontSize:14,fontFamily:"inherit",boxSizing:"border-box"}}/>
                </div>

                {/* Lettino extra */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f8faff",borderRadius:10,padding:"10px 14px",marginBottom:14,border:"1px solid #e8eeff"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:"bold",color:"#1a2e4a"}}>🛏️ Lettino aggiuntivo</div>
                    {disponibilita.tariffe?.lettino_extra>0&&<div style={{fontSize:11,color:"#888"}}>+€{disponibilita.tariffe.lettino_extra}/giorno</div>}
                  </div>
                  <button onClick={()=>setLettinoExtra(!lettinoExtra)} style={{width:48,height:26,borderRadius:13,border:"none",background:lettinoExtra?"#0d6efd":"#ccc",cursor:"pointer",position:"relative",transition:"all 0.2s"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:lettinoExtra?24:3,transition:"all 0.2s"}}/>
                  </button>
                </div>

                {/* Note */}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:13,color:"#1a2e4a",fontWeight:"bold",display:"block",marginBottom:4}}>📝 Note (opzionale)</label>
                  <textarea value={noteCliente} onChange={e=>setNoteCliente(e.target.value)} placeholder="Es. allergie, esigenze particolari, posizione preferita..." rows={3}
                    style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #ddd",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",resize:"none",outline:"none"}}/>
                </div>

                {/* Animale */}
                <div style={{marginBottom:14}}>
                  <button onClick={()=>setShowAvvisoAnimale(true)}
                    style={{width:"100%",padding:"10px 14px",borderRadius:10,border:portaAnimale?"2px solid #856404":"1px solid #ddd",background:portaAnimale?"#fff3cd":"#fff",color:portaAnimale?"#856404":"#555",cursor:"pointer",fontFamily:"inherit",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>🐕 Porto un animale</span>
                    {portaAnimale&&<span style={{fontSize:11,fontWeight:"bold"}}>{tagliaAnimale} ✓</span>}
                  </button>
                </div>

                {/* Prezzo totale */}
                {(()=>{
                  const prezzo = calcolaPrezzo(selectedUmb.id, viewDate, dataFine||viewDate, lettinoExtra);
                  return prezzo>0 ? (
                    <div style={{background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:"rgba(255,255,255,0.8)",fontSize:13}}>💰 Totale stimato</span>
                      <span style={{color:"#fff",fontSize:20,fontWeight:"bold"}}>€{prezzo}</span>
                    </div>
                  ) : null;
                })()}

                <button onClick={async()=>{
                  setSalvando(true);
                  try {
                    // Controllo postazione pet-friendly
                    if(portaAnimale && !(disponibilita.postazioni_pet||[]).includes(selectedUmb.id)) {
                      alert("Questa postazione non è disponibile per animali. Seleziona una postazione pet-friendly.");
                      setSalvando(false);
                      return;
                    }
                    await savePrenotazioneCliente({
                      id: Math.random().toString(36).slice(2),
                      nome: profilo?.nome||"",
                      cognome: profilo?.cognome||"",
                      telefono: profilo?.telefono||"",
                      userNome: profilo?.nome||"",
                      userCognome: profilo?.cognome||"",
                      userTelefono: profilo?.telefono||"",
                      lettinoExtra,
                      prezzoTotale: calcolaPrezzo(selectedUmb.id, viewDate, dataFine||viewDate, lettinoExtra),
                      note: noteCliente,
                      portaAnimale,
                      tagliaAnimale: portaAnimale ? tagliaAnimale : "",
                      
                      umbId: selectedUmb.id,
                      dal: viewDate,
                      al: dataFine||viewDate,
                      _single: !dataFine||dataFine===viewDate,
                      userId: user.uid,
                      userEmail: user.email,
                      status: "in_attesa"
                    });
                    setPrenotazioneOk(true);
                    setNoteCliente("");
                    loadRichiesteInAttesa().then(setRichiesteInAttesa).catch(()=>{});
                  } catch(e) { alert("Errore: "+e.message); }
                  setSalvando(false);
                }} disabled={salvando} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",fontSize:16,fontWeight:"bold",cursor:"pointer",fontFamily:"inherit",opacity:salvando?0.7:1}}>
                  {salvando?"Invio...":"📩 Invia Richiesta"}
                </button>
                <button onClick={()=>{setSelectedUmb(null);setDataFine("");}} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"#f0f0f0",color:"#555",fontSize:14,cursor:"pointer",fontFamily:"inherit",marginTop:8}}>
                  Annulla
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
