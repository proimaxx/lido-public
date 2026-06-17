import { useState, useEffect, useRef } from "react";
import { db, saveUmbrellas, subscribeUmbrellas } from "./firebase";

// ── COSTANTI COLORI ───────────────────────────────────────────────
const STATUS_COLORS = {
  libero:     { bg:"#d4edda", border:"#28a745", badge:"#155724", text:"Libero",      textColor:"#155724", dot:"#28a745" },
  occupato:   { bg:"#ff2020", border:"#dd0000", badge:"#dd0000", text:"Occupato",    textColor:"#fff", dot:"#ff2020" },
  prenotato:  { bg:"#fff3cd", border:"#ffc107", badge:"#856404", text:"Prenotato",   textColor:"#856404", dot:"#ffc107" },
  pagato:     { bg:"#cce5ff", border:"#0d6efd", badge:"#004085", text:"Pagato",      textColor:"#004085", dot:"#0d6efd" },
  pagato_pos: { bg:"#e8d5f5", border:"#7b2d8b", badge:"#4a1060", text:"Pagato POS", textColor:"#4a1060", dot:"#7b2d8b" },
};
const LS = { display:"block", fontSize:11, letterSpacing:2, color:"#999", textTransform:"uppercase", marginBottom:5, fontFamily:"inherit" };
const IS = { width:"100%", padding:"9px 13px", borderRadius:10, border:"2px solid #e8e8e8", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", color:"#1a2e4a" };
const SB = { width:36, height:36, borderRadius:10, border:"2px solid #e8e8e8", background:"#fff", fontSize:18, cursor:"pointer", color:"#1a2e4a", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold" };

// ── UTILITÀ ───────────────────────────────────────────────────────
const makeId = () => Math.random().toString(36).slice(2,9);
const toDateStr = (y,m,d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const todayStr = () => { const t=new Date(); return toDateStr(t.getFullYear(),t.getMonth(),t.getDate()); };
const isoLabel = (s) => s ? new Date(s+"T00:00:00").toLocaleDateString("it-IT",{day:"numeric",month:"short",year:"numeric"}) : "";
const fullName = (u) => {
  // prova prima dalla prenotazione di oggi, poi dalla radice
  const td = todayStr();
  const p = getPrenForDate(u, td);
  const nome = (p?.nome || u.nome || "").trim();
  const cognome = (p?.cognome || u.cognome || "").trim();
  return [nome, cognome].filter(Boolean).join(" ") || "—";
};
const dateInRange = (ds,dal,al) => dal && al && ds>=dal && ds<=al;

function makeUmbrellas(rows,cols){
  return Array.from({length:rows*cols},(_,i)=>({id:i+1,nome:"",cognome:"",indirizzo:"",telefono:"",prenotazioni:[]}));
}
function getPrenForDate(u,ds){
  return (u.prenotazioni||[]).find(p=>{
    if(p._single) return p.dal===ds;
    return dateInRange(ds,p.dal,p.al);
  })||null;
}
function statusOnDate(u,ds){ const p=getPrenForDate(u,ds); return p?p.status:"libero"; }

// ── MINI CALENDARIO per selezione date ───────────────────────────
// Supporta sia range (dal→al) che giorni singoli sparsi
function MiniCalendar({ occupiedRanges, selectedRanges, singleDates, onToggleDate, mode, rangeStart }) {
  const today = new Date();
  const [year,setYear] = useState(today.getFullYear());
  const [month,setMonth] = useState(today.getMonth());
  const daysInMonth = new Date(year,month+1,0).getDate();
  const firstDay = (new Date(year,month,1).getDay()+6)%7;
  const prevM=()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);};
  const nextM=()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);};
  const monthName = new Date(year,month).toLocaleString("it-IT",{month:"long",year:"numeric"});

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <button onClick={prevM} style={{...SB,width:28,height:28,fontSize:14}}>‹</button>
        <span style={{fontSize:13,fontWeight:"bold",color:"#1a2e4a",textTransform:"capitalize"}}>{monthName}</span>
        <button onClick={nextM} style={{...SB,width:28,height:28,fontSize:14}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
        {["L","M","M","G","V","S","D"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:9,color:"#bbb",fontWeight:"bold",padding:"2px 0"}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
        {Array.from({length:daysInMonth},(_,i)=>{
          const day=i+1;
          const ds=toDateStr(year,month,day);
          const td=todayStr();
          const isPast=ds<td;
          const isOccupied=occupiedRanges.some(r=>dateInRange(ds,r.dal,r.al));
          // selezione range
          const selRangeIdx=selectedRanges.findIndex(r=>dateInRange(ds,r.dal,r.al));
          const isInRange=selRangeIdx>=0;
          // selezione giorno singolo
          const isSingle=singleDates&&singleDates.some(s=>s.date===ds);
          const singleEntry=singleDates&&singleDates.find(s=>s.date===ds);
          const isSelected=isInRange||isSingle;
          const isToday=ds===td;
          const isRangeStart=rangeStart===ds;

          let bg="#fff",border="1px solid #eee",color="#555",cursor="pointer";
          if(isPast){bg="#f9f9f9";color="#ccc";cursor="default";}
          else if(isOccupied){bg="#f8d7da";border="1px solid #dc3545";color="#721c24";cursor="not-allowed";}
          else if(isInRange){const sc=STATUS_COLORS[selectedRanges[selRangeIdx].status];bg=sc.bg;border=`2px solid ${sc.border}`;color=sc.textColor;}
          else if(isSingle){const sc=STATUS_COLORS[singleEntry.status];bg=sc.bg;border=`2px solid ${sc.border}`;color=sc.textColor;}
          if(isToday&&!isSelected&&!isOccupied&&!isPast){border="2px solid #ffc107";}
          if(isRangeStart){border="3px solid #0d6efd";}

          return (
            <div key={day} onClick={()=>!isPast&&!isOccupied&&onToggleDate(ds)}
              style={{minHeight:30,borderRadius:6,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:bg,border,color,cursor,transition:"all 0.12s",fontSize:11,fontWeight:isSelected||isToday||isRangeStart?"bold":"normal",position:"relative",userSelect:"none"}}>
              {day}
              {isRangeStart&&<div style={{position:"absolute",bottom:2,width:5,height:5,borderRadius:"50%",background:"#0d6efd"}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SCHEDA CLIENTE / UMBRELLA MODAL ──────────────────────────────
function UmbrellaModal({ umbrella, allUmbrellas, viewDate, cols, disdette, gruppi, onSave, onUpdateGruppoCliente, onClose }) {
  const td = todayStr();
  const activeDate = viewDate || td;

  // Dati cliente dalla data visualizzata
  const todayPren = getPrenForDate(umbrella, activeDate);
  const emptyClient = { nome:"", cognome:"", indirizzo:"", telefono:"", cf:"", nota:"", lettino:false };
  const clientFromToday = todayPren
    ? { nome:todayPren.nome||"", cognome:todayPren.cognome||"", indirizzo:todayPren.indirizzo||"", telefono:todayPren.telefono||"", cf:todayPren.cf||"", nota:todayPren.nota||"", lettino:todayPren.lettino||false }
    : emptyClient;

  const [client,setClient] = useState(clientFromToday);
  const setC = (k,v) => setClient(f=>({...f,[k]:v}));

  // ogni prenotazione porta i suoi dati cliente dentro di sé
  const initPrenList = umbrella.prenotazioni ? umbrella.prenotazioni.map(p=>({...p})) : [];
  // Pre-seleziona la data solo se la postazione è libera in quella data
  const isLibero = !initPrenList.some(p=>p._single?p.dal===activeDate:dateInRange(activeDate,p.dal,p.al));
  const initList = isLibero && activeDate
    ? [...initPrenList, {id:makeId(),dal:activeDate,al:activeDate,status:"prenotato",prezzo:"",_single:true}]
    : initPrenList;
  const [prenList,setPrenList] = useState(initList);

  const [selMode,setSelMode] = useState("singoli");
  const [editingPrenId,setEditingPrenId] = useState(null);
  const [editingPopup,setEditingPopup] = useState(null);
  const [importoPopup,setImportoPopup] = useState(null); // {prenId, status}
  const [rangeStart,setRangeStart] = useState(null);
  const [pendingStatus,setPendingStatus] = useState("prenotato");
  const [pendingPrezzo,setPendingPrezzo] = useState("");

  const [suggestions,setSuggestions] = useState([]);
  const findMatches=(nome,cognome)=>{
    const q=(nome+" "+cognome).trim().toLowerCase();
    if(q.length<2) return [];
    // cerca tra tutte le prenotazioni di tutti gli ombrelloni
    const all = allUmbrellas.flatMap(u=>(u.prenotazioni||[]).map(p=>({...p, _umbId:u.id})));
    // aggiunge anche i clienti con disdette (non nelle prenotazioni attive)
    const disdClients = (disdette||[]).map(d=>({...d, _fromDisdette:true}));
    const combined = [...all, ...disdClients];
    // Deduplicazione per nome+cognome, preferendo record con telefono
    const byKey = new Map();
    combined.forEach(p=>{
      const fn=[p.nome,p.cognome].filter(Boolean).join(" ").toLowerCase();
      if(!fn.includes(q.split(" ")[0])&&!fn.includes(q)) return;
      const ex=byKey.get(fn);
      if(!ex||(p.telefono&&!ex.telefono)) byKey.set(fn,p);
    });
    return [...byKey.values()].slice(0,4);
  };

  // Ogni ombrellone è indipendente: non blocchiamo giorni perché altri ombrelloni sono occupati
  const occupiedByOthers = [];

  const handleToggleDate = (ds) => {
    if(selMode==="singoli") {
      const existIdx=prenList.findIndex(p=>p._single&&p.dal===ds);
      if(existIdx>=0){ setPrenList(l=>l.filter((_,i)=>i!==existIdx)); return; }
      const inRange=prenList.findIndex(p=>!p._single&&dateInRange(ds,p.dal,p.al));
      if(inRange>=0){ setPrenList(l=>l.filter((_,i)=>i!==inRange)); return; }
      // nuova prenotazione singola con dati cliente correnti nel form
      setPrenList(l=>[...l,{id:makeId(),dal:ds,al:ds,status:pendingStatus,prezzo:pendingPrezzo,_single:true,...client}]);
    } else {
      const existing=prenList.findIndex(p=>!p._single&&dateInRange(ds,p.dal,p.al));
      if(existing>=0){ setPrenList(l=>l.filter((_,i)=>i!==existing)); setRangeStart(null); return; }
      if(!rangeStart){
        setRangeStart(ds);
      } else {
        const dal=rangeStart<=ds?rangeStart:ds;
        const al=rangeStart<=ds?ds:rangeStart;
        // nuova prenotazione range con dati cliente correnti nel form
        setPrenList(l=>[...l,{id:makeId(),dal,al,status:pendingStatus,prezzo:pendingPrezzo,...client}]);
        setRangeStart(null);
        setPendingPrezzo("");
      }
    }
  };

  const handleSave = () => {
    const originalPrenIds = new Set((umbrella.prenotazioni||[]).map(p=>p.id));
    const updatedPrenList = prenList.map(p => {
      if (editingPrenId && p.id === editingPrenId) {
        return {...p, nome:client.nome, cognome:client.cognome, indirizzo:client.indirizzo, telefono:client.telefono, cf:client.cf, nota:client.nota||"", lettino:client.lettino||false };
      }
      if (!originalPrenIds.has(p.id)) {
        return {...p, nome:client.nome, cognome:client.cognome, indirizzo:client.indirizzo, telefono:client.telefono, cf:client.cf, nota:client.nota||"", lettino:client.lettino||false };
      }
      return p;
    });
    onSave({...umbrella, prenotazioni: updatedPrenList});
    setEditingPrenId(null);
    // Aggiorna gruppo nel profilo cliente
    if (client.telefono) {
      onUpdateGruppoCliente && onUpdateGruppoCliente(client.telefono, client.nota||"");
    }

    const newPrens = updatedPrenList.filter(p => !originalPrenIds.has(p.id) && p.telefono);
    if (newPrens.length > 0 && client.telefono) {
      const p = newPrens[0];
      const numOmb = umbrella.id;
      const fila = Math.ceil(numOmb / (cols||10));
      const posto = ((numOmb-1) % (cols||10)) + 1;
      const data = p._single ? isoLabel(p.dal) : `${isoLabel(p.dal)} - ${isoLabel(p.al)}`;
      const nome = [client.nome, client.cognome].filter(Boolean).join(" ");
      const msg = `Gentile ${nome}, confermiamo la Sua prenotazione:\n⛱️ Ombrellone N° ${numOmb} (Fila ${fila}, Posto ${posto})\nPeriodo: ${data}\nGrazie e a presto! ☀️

⏰ La prenotazione è riservata fino alle ore 12:00.
Oltre tale orario, senza preavviso di ritardo, ci riserviamo il diritto di liberare la postazione.
Per comunicazioni: risponda a questo messaggio.`;
      const tel = client.telefono.replace(/\s/g,"").replace(/^\+39/,"");
      const url = `https://wa.me/39${tel}?text=${encodeURIComponent(msg)}`;
      setTimeout(() => {
        if (window.confirm(`Vuoi inviare conferma WhatsApp a ${nome}?`)) {
          window.open(url, "_blank");
        }
      }, 300);
    }
  };

  const deletePren = (id) => { if(window.confirm("Eliminare questa prenotazione?")) setPrenList(l=>l.filter(p=>p.id!==id)); };
  const updatePren = (id,k,v) => setPrenList(l=>l.map(p=>p.id===id?{...p,[k]:v}:p));

  const cs = statusOnDate(umbrella, td);
  const sc = STATUS_COLORS[cs];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"#fff",borderRadius:22,padding:"24px 28px",width:700,maxWidth:"97vw",maxHeight:"95vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.28)",fontFamily:"'Georgia',serif",animation:"fadeUp 0.2s ease"}}>

        {/* HEADER */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#888",textTransform:"uppercase",marginBottom:3}}>Postazione</div>
            <div style={{fontSize:22,fontWeight:"bold",color:"#1a2e4a"}}>Ombrellone N° {umbrella.id}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{background:sc.badge,color:"#fff",fontSize:11,padding:"4px 12px",borderRadius:20,fontWeight:"bold"}}>{sc.text}</span>
            <button onClick={onClose} style={{...SB,background:"#f0f0f0",border:"none",fontSize:18,color:"#555"}}>×</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:16}}>

          {/* COLONNA SX */}
          <div>
            {/* Dati cliente */}
            <div style={{background:"#f8faff",borderRadius:14,padding:"14px 16px",marginBottom:14,border:"1px solid #e8eeff"}}>
              <div style={{fontSize:10,letterSpacing:2,color:"#0d6efd",textTransform:"uppercase",fontWeight:"bold",marginBottom:10}}>👤 Dati Cliente</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <div style={{flex:1}}><label style={LS}>Nome</label>
                  <input value={client.nome} onChange={e=>{setC("nome",e.target.value.toUpperCase());setSuggestions(findMatches(e.target.value,client.cognome));}} placeholder="Mario" style={{...IS,textTransform:"uppercase"}}/>
                </div>
                <div style={{flex:1}}><label style={LS}>Cognome</label>
                  <input value={client.cognome} onChange={e=>{setC("cognome",e.target.value.toUpperCase());setSuggestions(findMatches(client.nome,e.target.value));}} placeholder="Rossi" style={{...IS,textTransform:"uppercase"}}/>
                </div>
              </div>
              {suggestions.length>0&&(
                <div style={{marginBottom:8,border:"1px solid #0d6efd",borderRadius:10,overflow:"hidden"}}>
                  <div style={{padding:"5px 10px",background:"#e8f0ff",fontSize:10,color:"#0d6efd",fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>👤 Cliente esistente</div>
                  {suggestions.map((u,i)=>(
                    <div key={i} onClick={()=>{
                      // Arricchisci con dati dalle disdette se mancano
                      const dis=(disdette||[]).find(d=>d.nome===u.nome&&d.cognome===u.cognome);
                      // Cerca la nota nelle prenotazioni precedenti dello stesso cliente
                      const profilo=(disdette||[]).find(d=>d.telefono===u.telefono);const notaPrec=profilo?.gruppoId||allUmbrellas.flatMap(umb=>(umb.prenotazioni||[])).filter(p=>p.telefono===u.telefono&&p.nota).map(p=>p.nota)[0]||"";
                      // nota = ID gruppo dalla prenotazione precedente
                      setClient({nome:u.nome||"",cognome:u.cognome||"",indirizzo:u.indirizzo||dis?.indirizzo||"",telefono:u.telefono||dis?.telefono||"",cf:u.cf||dis?.cf||"",nota:u.nota||notaPrec||""});
                      setSuggestions([]);
                    }}
                      style={{padding:"6px 12px",background:"#fff",borderTop:"1px solid #e8eeff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}>
                      <strong style={{color:"#1a2e4a"}}>{fullName(u)}</strong>
                      {u.telefono&&<span style={{color:"#888",fontSize:11}}>📞 {u.telefono}</span>}
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                        {(disdette||[]).find(d=>d.nome===u.nome&&d.cognome===u.cognome)?.count > 0 &&
                          <span style={{background:"#dc3545",color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:10,fontWeight:"bold"}}>Disdette: {(disdette||[]).find(d=>d.nome===u.nome&&d.cognome===u.cognome)?.count}</span>
                        }
                        <span style={{fontSize:11,color:"#0d6efd",fontWeight:"bold"}}>Usa →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{marginBottom:8}}><label style={LS}>Indirizzo</label><input value={client.indirizzo} onChange={e=>setC("indirizzo",e.target.value)} placeholder="Via Roma 12, Milano" style={IS}/></div>
              <div style={{marginBottom:8}}>
                <label style={LS}>Telefono</label>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input value={client.telefono} onChange={e=>setC("telefono",e.target.value)} placeholder="333 1234567" type="tel" style={{...IS,flex:1}}/>
                  {client.telefono&&(<>
                    <a href={`tel:${client.telefono.replace(/\s/g,"")}`}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",width:38,height:38,borderRadius:10,background:"#28a745",color:"#fff",textDecoration:"none",fontSize:18,flexShrink:0}}
                      title={`Chiama ${client.telefono}`}>📞</a>
                    <a href={`https://wa.me/39${client.telefono.replace(/\s/g,"").replace(/^\+39/,"")}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{display:"flex",alignItems:"center",justifyContent:"center",width:38,height:38,borderRadius:10,background:"#25D366",color:"#fff",textDecoration:"none",fontSize:18,flexShrink:0}}
                      title={`WhatsApp ${client.telefono}`}>💬</a>
                  </>)}
                </div>
              </div>
              <div><label style={LS}>Codice Fiscale</label><input value={client.cf||""} onChange={e=>setC("cf",e.target.value.toUpperCase())} placeholder="RSSMRA80A01H501Z" style={{...IS,letterSpacing:1}} maxLength={16}/></div>
              <div style={{marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f0f7ff",borderRadius:10,padding:"10px 14px",border:"1px solid #cce0ff"}}>
                <span style={{fontSize:13,fontWeight:"bold",color:"#1a2e4a"}}>🛏️ Lettino aggiuntivo</span>
                <button onClick={()=>setC("lettino",!client.lettino)} style={{width:48,height:26,borderRadius:13,border:"none",background:client.lettino?"#0d6efd":"#ccc",cursor:"pointer",position:"relative",transition:"all 0.2s"}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:client.lettino?24:3,transition:"all 0.2s"}}/>
                </button>
              </div>
              <div style={{marginBottom:8}}>
                <label style={LS}>👥 Gruppo</label>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
                  <button onClick={()=>setC("nota","")} style={{padding:"4px 10px",borderRadius:8,border:!client.nota?"2px solid #333":"1px solid #ddd",background:"#fff",cursor:"pointer",fontSize:12,color:"#555"}}>Nessuno</button>
                  {(gruppi||[]).map(g=>(
                    <button key={g.id} onClick={()=>setC("nota",g.id)}
                      style={{padding:"4px 12px",borderRadius:8,border:client.nota===g.id?"2px solid #333":"2px solid transparent",background:g.colore,cursor:"pointer",fontSize:12,fontWeight:"bold",color:"#000",boxShadow:`0 0 8px ${g.colore}`}}>
                      {g.nome}
                    </button>
                  ))}
                  {(gruppi||[]).length===0&&<span style={{fontSize:11,color:"#aaa"}}>Nessun gruppo creato — aggiungi da Impostazioni Griglia</span>}
                </div>
              </div>
              <button onClick={handleSave} style={{width:"100%",padding:"14px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:15,fontWeight:"bold",boxShadow:"0 4px 14px rgba(13,59,110,0.3)",marginTop:8}}>💾 Salva prenotazione</button>
            </div>

            {/* Lista prenotazioni */}
            <div>
              <div style={{fontSize:10,letterSpacing:2,color:"#856404",textTransform:"uppercase",fontWeight:"bold",marginBottom:8}}>📅 Prenotazioni ({prenList.length}){editingPrenId&&<span style={{marginLeft:8,color:"#0d6efd",fontSize:10,textTransform:"none"}}>in modifica</span>}</div>
              {prenList.length===0?(
                <div style={{textAlign:"center",padding:"16px",color:"#bbb",fontSize:12,borderRadius:10,border:"2px dashed #eee"}}>
                  Seleziona le date sul calendario →
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:240,overflowY:"auto"}}>
                  {[...prenList].sort((a,b)=>a.dal.localeCompare(b.dal)).map(p=>{
                    const sc2=STATUS_COLORS[p.status];
                    const label=p._single ? isoLabel(p.dal) : `${isoLabel(p.dal)} → ${isoLabel(p.al)}`;
                    const pClient = [p.nome,p.cognome].filter(Boolean).join(" ");
                    return (
                      <div key={p.id} onClick={()=>setEditingPopup(p.id)} style={{borderRadius:10,border:`2px solid ${sc2.border}`,background:sc2.bg,padding:"10px 12px",cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                          <div>
                            <div style={{fontSize:11,fontWeight:"bold",color:sc2.textColor}}>
                              {p._single&&<span style={{fontSize:10,opacity:0.7,marginRight:5}}>📌</span>}{label}
                            </div>
                            {pClient&&<div style={{fontSize:10,color:sc2.textColor,opacity:0.8}}>👤 {pClient}</div>}
                          </div>
                          <div style={{display:"flex",gap:5}}>
                            <button onClick={()=>{setClient({nome:p.nome||"",cognome:p.cognome||"",indirizzo:p.indirizzo||"",telefono:p.telefono||"",cf:p.cf||""});setEditingPrenId(p.id);}}
                              style={{background:"#e8f0ff",border:"1px solid #0d6efd",borderRadius:7,cursor:"pointer",color:"#0d6efd",fontSize:10,padding:"2px 7px",fontWeight:"bold"}}>Modifica</button>
                            <button onClick={()=>deletePren(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc3545",fontSize:16,padding:0}}>×</button>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>
                          {Object.entries(STATUS_COLORS).filter(([k])=>k!=="libero").map(([k,v])=>(
                            <button key={k} onClick={()=>updatePren(p.id,"status",k)} style={{padding:"2px 7px",borderRadius:7,border:`1px solid ${p.status===k?v.border:"#ddd"}`,background:p.status===k?v.bg:"#fafafa",color:p.status===k?v.badge:"#999",fontSize:9,cursor:"pointer",fontWeight:p.status===k?"bold":"normal"}}>{v.text}</button>
                          ))}
                        </div>
                        <input type="number" value={p.prezzo||""} onChange={e=>updatePren(p.id,"prezzo",e.target.value)}
                          placeholder="€ Prezzo" style={{...IS,padding:"4px 9px",fontSize:11}}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLONNA DX: calendario */}
          <div>
            <div style={{background:"#f5f8ff",borderRadius:14,padding:"14px 16px",border:"1px solid #e8eeff"}}>
              <div style={{fontSize:10,letterSpacing:2,color:"#0d6efd",textTransform:"uppercase",fontWeight:"bold",marginBottom:10}}>📅 Seleziona Date</div>

              {/* Modalità selezione */}
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                {[["periodo","📆 Periodo (dal→al)"],["singoli","📌 Giorni singoli"]].map(([m,label])=>(
                  <button key={m} onClick={()=>{setSelMode(m);setRangeStart(null);}} style={{flex:1,padding:"7px 0",borderRadius:9,border:`2px solid ${selMode===m?"#0d6efd":"#ddd"}`,background:selMode===m?"#e8f0ff":"#fff",color:selMode===m?"#0d3b6e":"#888",fontWeight:selMode===m?"bold":"normal",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>{label}</button>
                ))}
              </div>

              {/* Stato e prezzo pendenti */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#888",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Stato</div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:6}}>
                  {Object.entries(STATUS_COLORS).filter(([k])=>k!=="libero").map(([k,v])=>(
                    <button key={k} onClick={()=>setPendingStatus(k)} style={{padding:"3px 8px",borderRadius:7,border:`1px solid ${pendingStatus===k?v.border:"#ddd"}`,background:pendingStatus===k?v.bg:"#fff",color:pendingStatus===k?v.badge:"#999",fontSize:10,cursor:"pointer",fontWeight:pendingStatus===k?"bold":"normal"}}>{v.text}</button>
                  ))}
                </div>
                <div style={{marginTop:4}}>
                  <div style={{fontSize:10,color:"#888",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Importo</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginBottom:5}}>
                    {[5,10,15,20,25,30].map(i=>(
                      <button key={i} onClick={()=>setPendingPrezzo(String(i))} style={{padding:"8px 0",borderRadius:9,border:`1px solid ${pendingPrezzo===String(i)?"#0d6efd":"#ddd"}`,background:pendingPrezzo===String(i)?"#0d6efd":"#fff",color:pendingPrezzo===String(i)?"#fff":"#555",fontSize:13,cursor:"pointer",fontWeight:"bold"}}>€{i}</button>
                    ))}
                  </div>
                  <input type="number" value={pendingPrezzo} onChange={e=>setPendingPrezzo(e.target.value)} placeholder="€ Altro importo" style={{...IS,padding:"6px 10px",fontSize:12}}/>
                </div>
              </div>

              {/* Istruzione contestuale */}
              <div style={{fontSize:11,color:"#555",marginBottom:8,padding:"6px 10px",background:"#fff",borderRadius:8,border:"1px solid #e8eeff"}}>
                {selMode==="periodo"
                  ? rangeStart
                    ? <span>✅ Inizio: <strong>{isoLabel(rangeStart)}</strong> — clicca la data di fine</span>
                    : <span>👆 Clicca <strong>inizio</strong> poi <strong>fine</strong> del periodo</span>
                  : <span>👆 Clicca più giorni singoli (es. tutte le domeniche). Riclicca per rimuovere.</span>
                }
              </div>

              <MiniCalendar
                occupiedRanges={occupiedByOthers}
                selectedRanges={prenList.filter(p=>!p._single)}
                singleDates={prenList.filter(p=>p._single).map(p=>({date:p.dal,status:p.status,id:p.id}))}
                onToggleDate={handleToggleDate}
                mode={selMode}
                rangeStart={rangeStart}
              />

              {/* Legenda */}
              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:"#555"}}><div style={{width:7,height:7,borderRadius:2,background:"#dc3545"}}/> Occupato</div>
                {Object.entries(STATUS_COLORS).filter(([k])=>k!=="libero").map(([k,v])=>(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:v.textColor}}><div style={{width:7,height:7,borderRadius:2,background:v.border}}/>{v.text}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* POPUP MODIFICA PRENOTAZIONE */}
        {editingPopup && prenList.find(x=>x.id===editingPopup) && (()=>{
          const p = prenList.find(x=>x.id===editingPopup);
          const sc2=STATUS_COLORS[p.status];
          const label=p._single ? isoLabel(p.dal) : `${isoLabel(p.dal)} → ${isoLabel(p.al)}`;
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000}} onClick={()=>setEditingPopup(null)}>
              <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"20px",padding:"24px 20px 28px",width:"100%",maxWidth:500,boxShadow:"0 -10px 40px rgba(0,0,0,0.2)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:"bold",color:"#1a2e4a"}}>{label}</div>
                    {[p.nome,p.cognome].filter(Boolean).length>0&&<div style={{fontSize:11,color:"#888"}}>👤 {[p.nome,p.cognome].filter(Boolean).join(" ")}</div>}
                  </div>
                  <button onClick={()=>setEditingPopup(null)} style={{background:"#f0f0f0",border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16,color:"#555"}}>×</button>
                </div>
                <div style={{fontSize:11,color:"#888",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Stato</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                  {Object.entries(STATUS_COLORS).filter(([k])=>k!=="libero").map(([k,v])=>(
                    <button key={k} onClick={()=>{
                      updatePren(p.id,"status",k);
                      if(k==="pagato"||k==="pagato_pos") setImportoPopup({prenId:p.id});
                    }}
                      style={{padding:"14px 8px",borderRadius:12,border:`2px solid ${p.status===k?v.border:"#eee"}`,background:p.status===k?v.bg:"#fafafa",color:p.status===k?v.badge:"#999",fontSize:14,cursor:"pointer",fontWeight:p.status===k?"bold":"normal",textAlign:"center"}}>
                      {v.text}
                    </button>
                  ))}
                </div>
                {(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:"#888",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>💳 Importo</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
                      {[5,10,15,20,25,30].map(i=>(
                        <button key={i} onClick={()=>updatePren(p.id,"prezzo",String(i))} style={{padding:"12px 0",borderRadius:10,border:`2px solid ${p.prezzo===String(i)?"#0d6efd":"#eee"}`,background:p.prezzo===String(i)?"#0d6efd":"#fafafa",color:p.prezzo===String(i)?"#fff":"#555",fontSize:15,cursor:"pointer",fontWeight:"bold"}}>€{i}</button>
                      ))}
                    </div>
                    <input type="number" value={p.prezzo||""} onChange={e=>updatePren(p.id,"prezzo",e.target.value)} placeholder="€ Altro importo" style={{...IS,fontSize:14,padding:"8px 12px"}}/>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{deletePren(p.id);setEditingPopup(null);}}
                    style={{flex:1,padding:"13px 0",borderRadius:12,border:"2px solid #dc3545",background:"#fff",color:"#dc3545",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>🗑️ Elimina</button>
                  <button onClick={()=>{setClient({nome:p.nome||"",cognome:p.cognome||"",indirizzo:p.indirizzo||"",telefono:p.telefono||"",cf:p.cf||""});setEditingPrenId(p.id);setEditingPopup(null);}}
                    style={{flex:1,padding:"13px 0",borderRadius:12,border:"2px solid #0d6efd",background:"#e8f0ff",color:"#0d6efd",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>✏️ Cliente</button>
                  <button onClick={()=>setEditingPopup(null)}
                    style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>✓ Fatto</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* FOOTER */}
        <div style={{display:"flex",gap:8,marginTop:18}}>
          <button onClick={onClose} style={{flex:1,padding:"11px 0",borderRadius:12,border:"2px solid #e0e0e0",background:"#fff",color:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:14}}>Annulla</button>
          <button onClick={handleSave} style={{flex:2,padding:"11px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:"bold",boxShadow:"0 4px 14px rgba(13,59,110,0.3)"}}>💾 Salva</button>
        </div>
      </div>

    </div>
  );
}

// ── GRID SETTINGS ─────────────────────────────────────────────────
function GridSettingsModal({ rows, cols, fontSize, cellHeight, cellWidth: initCellWidth, onApply, onClose }) {
  const [r,setR]=useState(rows);
  const [cc,setCc]=useState(cols);
  const [fs,setFs]=useState(fontSize||14);
  const [ch,setCh]=useState(cellHeight||100);
  const [cw,setCw]=useState(initCellWidth||80);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.6)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000}}>
      <div style={{background:"#fff",borderRadius:20,padding:"28px 32px",width:380,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.3)",fontFamily:"'Georgia',serif",animation:"fadeUp 0.22s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a"}}>Impostazioni Griglia</div>
          <button onClick={onClose} style={{...SB,background:"#f0f0f0",border:"none",fontSize:18,color:"#555"}}>×</button>
        </div>
        {[["File",r,setR,1,20],["Colonne",cc,setCc,1,20]].map(([label,val,setVal,mn,mx])=>(
          <div key={label} style={{marginBottom:16}}>
            <label style={LS}>{label} — <strong>{val}</strong></label>
            <input type="range" min={mn} max={mx} value={val} onChange={e=>setVal(Number(e.target.value))} style={{width:"100%",marginTop:5,accentColor:"#1a5c9a",height:28}}/>
          </div>
        ))}
        <div style={{marginBottom:16}}>
          <label style={LS}>Dimensione testo nome — <strong>{fs}px</strong></label>
          <input type="range" min={8} max={22} value={fs} onChange={e=>setFs(Number(e.target.value))} style={{width:"100%",marginTop:5,accentColor:"#1a5c9a",height:28}}/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={LS}>Altezza casella — <strong>{ch}px</strong></label>
          <input type="range" min={60} max={200} step={5} value={ch} onChange={e=>setCh(Number(e.target.value))} style={{width:"100%",marginTop:5,accentColor:"#1a5c9a",height:28}}/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={LS}>Larghezza casella — <strong>{cw}px</strong></label>
          <input type="range" min={50} max={200} step={5} value={cw} onChange={e=>setCw(Number(e.target.value))} style={{width:"100%",marginTop:5,accentColor:"#1a5c9a",height:28}}/>
        </div>
        <div style={{background:"#f0f7ff",borderRadius:10,padding:"9px",marginBottom:16,fontSize:12,color:"#1a5c9a",textAlign:"center"}}>
          Totale: <strong>{r*cc}</strong> ombrelloni
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"10px 0",borderRadius:12,border:"2px solid #e0e0e0",background:"#fff",color:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Annulla</button>
          <button onClick={()=>onApply(r,cc,fs,ch,cw)} style={{flex:2,padding:"10px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>Applica</button>
        </div>
      </div>
    </div>
  );
}

// ── DATABASE CLIENTI ─────────────────────────────────────────────
function DatabaseModal({ umbrellas, disdette, onSaveUmbrellas, onClose }) {
  const [search,setSearch] = useState("");
  const [editingClient,setEditingClient] = useState(null);
  const [editForm,setEditForm] = useState({});

  const allPrens = umbrellas.flatMap(u=>(u.prenotazioni||[]).map(p=>({...p,umbId:u.id})));
  const allSrc = [...allPrens, ...(onSaveUmbrellas?[]:[]), ...(disdette||[])];
  const seen = new Set();
  const uniqueClients = allSrc
    .filter(p=>p.nome||p.cognome||p.telefono)
    .reduce((acc,p)=>{ const k=[p.nome,p.cognome].join("|").toLowerCase(); const ex=acc.find(x=>[x.nome,x.cognome].join("|").toLowerCase()===k); if(!ex){acc.push(p);}else if(p.telefono&&!ex.telefono){Object.assign(ex,p);}return acc; },[])
    .filter(r=>{ const q=search.toLowerCase(); return !q||[r.nome,r.cognome,r.telefono,r.indirizzo,r.cf].join(" ").toLowerCase().includes(q); })
    .sort((a,b)=>(a.cognome||"").localeCompare(b.cognome||""));

  const removeClient = (client) => {
    if (!window.confirm(`Rimuovere ${[client.nome,client.cognome].filter(Boolean).join(" ")}?`)) return;
    const updated = umbrellas.map(u=>({...u,prenotazioni:(u.prenotazioni||[]).filter(p=>!(p.nome===client.nome&&p.cognome===client.cognome&&p.telefono===client.telefono))}));
    onSaveUmbrellas(updated);
  };

  const saveEdit = () => {
    const updated = umbrellas.map(u=>({...u,prenotazioni:(u.prenotazioni||[]).map(p=>p.nome===editingClient.nome&&p.cognome===editingClient.cognome&&p.telefono===editingClient.telefono?{...p,...editForm}:p)}));
    onSaveUmbrellas(updated);
    setEditingClient(null);
  };

  const rows = uniqueClients;

  const handlePrint=()=>{
    const trs=rows.map(r=>`<tr>
      <td><strong>${r.cognome||""}</strong></td>
      <td>${r.nome||""}</td>
      <td>${r.indirizzo||"—"}</td>
      <td>${r.telefono||"—"}</td>
      <td>${r.cf||"—"}</td>
    </tr>`).join("");
    const win=window.open("","_blank");
    win.document.write(`<html><head><title>Database Clienti</title><style>
      body{font-family:Georgia,serif;padding:32px;color:#1a2e4a}
      h1{font-size:22px;margin-bottom:4px}
      p{color:#888;font-size:13px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#1a2e4a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase}
      td{padding:9px 12px;border-bottom:1px solid #eee}
      tr:nth-child(even) td{background:#f9f9f9}
      @media print{body{padding:16px}}
    </style></head><body>
    <h1>☀️ Clienti Stabilimento Balneare</h1>
    <p>Stampato il ${new Date().toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric"})} — ${rows.length} clienti</p>
    <table>
      <thead><tr><th>Cognome</th><th>Nome</th><th>Indirizzo</th><th>Telefono</th><th>Cod. Fiscale</th></tr></thead>
      <tbody>${trs}</tbody>
    </table>
    <script>window.onload=()=>window.print();</script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5000}}>
      <div style={{background:"#fff",borderRadius:24,padding:"28px 32px",width:720,maxWidth:"96vw",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 40px 100px rgba(0,0,0,0.3)",fontFamily:"'Georgia',serif",animation:"fadeUp 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexShrink:0}}>
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#888",textTransform:"uppercase",marginBottom:3}}>👥 Archivio</div>
            <div style={{fontSize:22,fontWeight:"bold",color:"#1a2e4a"}}>Database Clienti</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>{uniqueClients.length} clienti</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handlePrint} style={{display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>🖨️ Stampa / PDF</button>
            <button onClick={onClose} style={{...SB,background:"#f0f0f0",border:"none",fontSize:18,color:"#555"}}>×</button>
          </div>
        </div>
        {editingClient ? (
          <div style={{padding:"8px 0"}}>
            <div style={{fontSize:14,fontWeight:"bold",color:"#1a2e4a",marginBottom:12}}>✏️ Modifica: {[editingClient.cognome,editingClient.nome].filter(Boolean).join(" ")}</div>
            {[["Nome","nome"],["Cognome","cognome"],["Indirizzo","indirizzo"],["Telefono","telefono"],["Cod. Fiscale","cf"]].map(([label,key])=>(
              <div key={key} style={{marginBottom:10}}>
                <label style={LS}>{label}</label>
                <input value={editForm[key]||""} onChange={e=>setEditForm(f=>({...f,[key]:e.target.value}))} style={IS}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>setEditingClient(null)} style={{flex:1,padding:"10px 0",borderRadius:12,border:"2px solid #eee",background:"#fff",color:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Annulla</button>
              <button onClick={saveEdit} style={{flex:2,padding:"10px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>💾 Salva</button>
            </div>
          </div>
        ) : (
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cerca per nome, cognome, telefono…" style={{...IS,marginBottom:16,flexShrink:0}}/>
        )}
        <div style={{overflowY:"auto",flex:1}}>
          {rows.length===0?<div style={{textAlign:"center",padding:"40px 0",color:"#aaa"}}>Nessun cliente trovato</div>:(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {rows.map((r,i)=>(
                <div key={r.telefono||i} style={{background:"#f8faff",borderRadius:12,padding:"12px 16px",border:"1px solid #e8eeff",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:"bold",color:"#1a2e4a",fontSize:14}}>{[r.cognome,r.nome].filter(Boolean).join(" ")||"—"}</div>
                    <div style={{fontSize:12,color:"#888",marginTop:3,display:"flex",gap:12,flexWrap:"wrap"}}>
                      {r.telefono&&<span>📞 {r.telefono}</span>}
                      {r.indirizzo&&<span>📍 {r.indirizzo}</span>}
                      {r.cf&&<span>🪪 {r.cf}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>{setEditingClient(r);setEditForm({nome:r.nome||"",cognome:r.cognome||"",indirizzo:r.indirizzo||"",telefono:r.telefono||"",cf:r.cf||""});}}
                      style={{padding:"6px 12px",borderRadius:9,border:"1px solid #0d6efd",background:"#e8f0ff",color:"#0d6efd",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>✏️</button>
                    <button onClick={()=>removeClient(r)}
                      style={{padding:"6px 12px",borderRadius:9,border:"1px solid #dc3545",background:"#fff",color:"#dc3545",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CALENDARIO PRINCIPALE ─────────────────────────────────────────
function CalendarView({ umbrellas, selectedDate, onSelectDate, onSave, onClose, cols, cellWidth, cellHeight, nameFontSize }) {
  const today = new Date();
  const td = todayStr();
  const [year,setYear]   = useState(today.getFullYear());
  const [month,setMonth] = useState(today.getMonth());
  const [bookingDate,setBookingDate] = useState(null);
  const [editUmb,setEditUmb] = useState(null);

  const monthName   = new Date(year,month).toLocaleString("it-IT",{month:"long",year:"numeric"});
  const daysInMonth = new Date(year,month+1,0).getDate();
  const firstDay    = (new Date(year,month,1).getDay()+6)%7;
  const prevM=()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);};
  const nextM=()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);};

  const getForDay=(ds)=>umbrellas.filter(u=>(u.prenotazioni||[]).some(p=>p._single?p.dal===ds:dateInRange(ds,p.dal,p.al)));
  const bookingLabel = bookingDate ? new Date(bookingDate+"T00:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : "";

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000}}>
      <div style={{background:"#fff",borderRadius:24,padding:"26px 30px",width:760,maxWidth:"96vw",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 40px 100px rgba(0,0,0,0.3)",fontFamily:"'Georgia',serif",animation:"fadeUp 0.22s ease"}}>

        {!bookingDate&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#888",textTransform:"uppercase",marginBottom:3}}>📅 Calendario</div>
              <div style={{fontSize:20,fontWeight:"bold",color:"#1a2e4a",textTransform:"capitalize"}}>{monthName}</div>
              <div style={{fontSize:11,color:"#888",marginTop:1}}>Clicca un giorno per gestire le prenotazioni</div>
            </div>
            <div style={{display:"flex",gap:7}}>
              <button onClick={prevM} style={{...SB,fontSize:16}}>‹</button>
              <button onClick={nextM} style={{...SB,fontSize:16}}>›</button>
              <button onClick={onClose} style={{...SB,marginLeft:6,background:"#f0f0f0",border:"none",fontSize:18,color:"#555"}}>×</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
            {["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:"bold",color:"#bbb",letterSpacing:1,padding:"3px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}
            {Array.from({length:daysInMonth},(_,i)=>{
              const day=i+1,ds=toDateStr(year,month,day);
              const isToday=ds===td,isSel=selectedDate===ds,isPast=ds<td;
              const entries=getForDay(ds);
              return (
                <div key={day} onClick={()=>{if(!isPast){onSelectDate(ds);setBookingDate(ds);}}}
                  style={{minHeight:72,borderRadius:10,padding:"5px",background:isSel?"#e8f0ff":isToday?"#fff8e1":isPast?"#fafafa":"#fff",border:isSel?"2px solid #0d6efd":isToday?"2px solid #ffc107":"1px solid #eee",cursor:isPast?"default":"pointer",opacity:isPast?0.4:1,overflow:"hidden"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                    <span style={{fontSize:11,fontWeight:isToday||isSel?"bold":"normal",color:isSel?"#0d6efd":isToday?"#856404":"#555"}}>{day}</span>
                    {!isPast&&entries.length===0&&<span style={{fontSize:7,color:"#28a745"}}>●</span>}
                  </div>
                  {entries.slice(0,3).map(u=>{
                    const p=getPrenForDate(u,ds);
                    const sc=STATUS_COLORS[p?.status||"libero"];
                    return <div key={u.id} style={{fontSize:8,padding:"1px 4px",borderRadius:5,marginBottom:1,background:sc.bg,color:sc.textColor,border:`1px solid ${sc.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:"bold"}}>{String.fromCharCode(65+Math.floor((u.id-1)/(cols||10)))}{((u.id-1)%(cols||10))+1} {fullName(u)}</div>;
                  })}
                  {entries.length>3&&<div style={{fontSize:7,color:"#999"}}>+{entries.length-3}</div>}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:12,marginTop:14,flexWrap:"wrap"}}>
            {Object.entries(STATUS_COLORS).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#666"}}><div style={{width:8,height:8,borderRadius:3,background:v.border}}/>{v.text}</div>)}
          </div>
        </>}

        {bookingDate&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <button onClick={()=>setBookingDate(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#0d6efd",fontSize:13,fontFamily:"inherit",padding:0,marginBottom:5}}>← Torna al calendario</button>
              <div style={{fontSize:10,letterSpacing:3,color:"#888",textTransform:"uppercase",marginBottom:3}}>📅 Prenotazione</div>
              <div style={{fontSize:17,fontWeight:"bold",color:"#1a2e4a",textTransform:"capitalize"}}>{bookingLabel}</div>
            </div>
            <button onClick={onClose} style={{...SB,background:"#f0f0f0",border:"none",fontSize:18,color:"#555"}}>×</button>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {Object.entries(STATUS_COLORS).map(([k,v])=><div key={k} style={{display:"flex",alignItems:"center",gap:4,background:v.bg,borderRadius:20,padding:"3px 10px",border:`1px solid ${v.border}`,fontSize:11,color:v.textColor,fontWeight:"bold"}}><div style={{width:6,height:6,borderRadius:"50%",background:v.border}}/>{v.text}</div>)}
          </div>
          <div style={{display:"flex",alignItems:"center",marginBottom:8,fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase"}}>
            <span>🌊 Mare</span><div style={{flex:1,height:1,background:"#eee",margin:"0 10px"}}/><span>⬆️ Prima fila</span>
          </div>
          <div style={{background:"linear-gradient(160deg,#0d3b6e,#1a5c9a,#2980b9)",borderRadius:16,padding:12}}>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${cols||10},${cellWidth||80}px)`,gap:6,overflowX:"auto"}}>
              {umbrellas.map(u=>{
                const es=statusOnDate(u,bookingDate);
                const c=STATUS_COLORS[es];
                return (
                  <div key={u.id} className="ucell" onClick={()=>setEditUmb(u)}
                    style={{background:c.bg,border:`2px solid ${c.border}`,borderRadius:11,padding:"7px 6px",height:cellHeight||100,maxHeight:cellHeight||100,overflow:"hidden",boxShadow:`0 2px 8px ${c.border}33`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <span style={{fontSize:12}}>⛱️</span>
                      <span style={{background:c.badge,color:"#fff",fontSize:7,padding:"1px 4px",borderRadius:20,fontWeight:"bold",textTransform:"uppercase"}}>{es}</span>
                    </div>
                    <div style={{fontSize:13,fontWeight:"bold",color:"#1a1a1a",marginTop:2}}>{String.fromCharCode(65+Math.floor((u.id-1)/(cols||10)))}{((u.id-1)%(cols||10))+1}</div>
                    {es!=="libero"&&fullName(u)!=="—"?<div style={{fontSize:nameFontSize||14,color:"#1a1a1a",fontWeight:"bold",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",WebkitLineClamp:2,display:"-webkit-box",WebkitBoxOrient:"vertical"}}>{fullName(u)}</div>:<div style={{fontSize:7,color:"rgba(0,0,0,0.25)",marginTop:1}}>libero</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",marginTop:8,fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase"}}>
            <span>⬇️ Ultima fila</span><div style={{flex:1,height:1,background:"#eee",margin:"0 10px"}}/><span>🏖️ Entrata</span>
          </div>
          <div style={{marginTop:8,fontSize:11,color:"#888",textAlign:"center"}}>Clicca un ombrellone per aprire la scheda</div>
        </>}
      </div>

      {editUmb&&<UmbrellaModal umbrella={editUmb} allUmbrellas={umbrellas} onSave={u=>{onSave(u);setEditUmb(null);}} onClose={()=>setEditUmb(null)}/>}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const [rows,setRows]           = useState(5);
  const [cols,setCols]           = useState(10);
  const [umbrellas,setUmbrellas] = useState(()=>makeUmbrellas(5,10));
  const [selected,setSelected]   = useState(null); // id number, not object
  const [filter,setFilter]       = useState("tutti");
  const [search,setSearch]       = useState("");
  const [showGrid,setShowGrid]   = useState(false);
  const [nameFontSize,setNameFontSize] = useState(()=>parseInt(localStorage.getItem("nameFontSize")||"14"));
  const [cellHeight,setCellHeight]   = useState(()=>parseInt(localStorage.getItem("cellHeight")||"100"));
  const [cellWidth,setCellWidth]     = useState(()=>parseInt(localStorage.getItem("cellWidth")||"80"));
  const [showCal,setShowCal]     = useState(false);
  const [showDB,setShowDB]       = useState(false);
  const [showSummary,setShowSummary] = useState(false);
  const [showMsgGiorno,setShowMsgGiorno] = useState(false);
  const [meteo,setMeteo] = useState(null);
  const [showGruppi,setShowGruppi] = useState(false);
  const [nuovoNome,setNuovoNome] = useState("");
  const [nuovoColore,setNuovoColore] = useState("#FF0080");
  const [storicoPopup,setStoricoPopup] = useState(null); // cliente
  const [scambioId,setScambioId]         = useState(null); // id ombrellone da scambiare
  const [msgInviati,setMsgInviati] = useState(()=>{ try { const s=JSON.parse(localStorage.getItem("msgInviati")||"null"); return s&&s.date===new Date().toISOString().slice(0,10)?s.tels:[]; } catch(e){return [];} });

  const [quickPopup,setQuickPopup]   = useState(null);
  const [disdette,setDisdette]       = useState([]);
  const [gruppi,setGruppi]             = useState([]); // [{id,nome,colore}]
  const [selectedDate,setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isRemoteUpdate = useRef(false);

  // Carica meteo
  useEffect(()=>{
    fetch("https://api.openweathermap.org/data/2.5/forecast?q=Vigna+di+Valle,IT&appid=002d7da12aba36c5e8bbeca3ef46bfdd&units=metric&lang=it&cnt=5")
      .then(r=>r.json())
      .then(d=>{
        if(d.list) setMeteo(d.list.slice(0,5).map(i=>({
          temp: Math.round(i.main.temp),
          desc: i.weather[0].description,
          icon: i.weather[0].icon
        })));
      })
      .catch(()=>{});
  }, []);

  useEffect(() => {
    const unsub = subscribeUmbrellas(db, (data) => {
      if (data && data.umbrellas && data.umbrellas.length > 0) {
        isRemoteUpdate.current = true;
        setUmbrellas(data.umbrellas);
        if (data.rows) setRows(data.rows);
        if (data.cols) setCols(data.cols);
        if (data.nameFontSize) { setNameFontSize(data.nameFontSize); localStorage.setItem("nameFontSize", data.nameFontSize); }
        if (data.cellHeight) { setCellHeight(data.cellHeight); localStorage.setItem("cellHeight", data.cellHeight); }
        if (data.cellWidth) { setCellWidth(data.cellWidth); localStorage.setItem("cellWidth", data.cellWidth); }
        if (data.disdette) setDisdette(data.disdette);
        if (data.gruppi) setGruppi(data.gruppi);
      } else if (data && Array.isArray(data) && data.length > 0) {
        isRemoteUpdate.current = true;
        setUmbrellas(data);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    setSaving(true);
    const t = setTimeout(() => {
      saveUmbrellas(db, umbrellas, rows, cols, nameFontSize, cellHeight, cellWidth, disdette, gruppi).finally(() => setSaving(false));
    }, 800);
    return () => clearTimeout(t);
  }, [umbrellas, rows, cols, nameFontSize, cellHeight, cellWidth, disdette, gruppi]);

  // Salva immediatamente cellWidth/cellHeight/nameFontSize quando cambiano
  useEffect(() => {
    if (loading) return;
    localStorage.setItem('cellWidth', cellWidth);
    localStorage.setItem('cellHeight', cellHeight);
    localStorage.setItem('nameFontSize', nameFontSize);
  }, [cellWidth, cellHeight, nameFontSize]);


  const td = todayStr();
  const viewDate = selectedDate || td;

  const handleApplyGrid=(nr,nc,fs,ch,cw)=>{
    if(fs) setNameFontSize(fs);
    if(ch) setCellHeight(ch);
    if(cw) setCellWidth(cw);
    const t=nr*nc;
    setUmbrellas(prev=>{
      if(t>prev.length){const ex=Array.from({length:t-prev.length},(_,i)=>({id:prev.length+i+1,nome:"",cognome:"",indirizzo:"",telefono:"",prenotazioni:[]}));return[...prev,...ex];}
      return prev.slice(0,t);
    });
    setRows(nr);setCols(nc);setShowGrid(false);
  };
  const handlePrintGrid = () => {
    const dateLabel = new Date(viewDate+"T00:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const cellW = Math.max(70, cellHeight*0.8);
    const cells = Array.from({length:rows*cols},(_,i)=>{
      const id=i+1, u=umbrellas.find(x=>x.id===id);
      if(!u) return "";
      const es = statusOnDate(u, viewDate);
      const sc = STATUS_COLORS[es];
      const prenView = getPrenForDate(u, viewDate);
      const nome = prenView ? [prenView.nome,prenView.cognome].filter(Boolean).join(" ") : "";
      return `<div style="background:${sc.bg};border:2px solid ${sc.border};border-radius:8px;padding:6px;min-height:${cellHeight*0.7}px;min-width:${cellW}px;display:flex;flex-direction:column;justify-content:space-between;"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:10px;">⛱️</span><span style="background:${sc.badge};color:#fff;font-size:7px;padding:1px 4px;border-radius:10px;font-weight:bold;">${es}</span></div><div style="font-size:10px;font-weight:bold;color:${sc.textColor};">#${id}</div>${nome?`<div style="font-size:${nameFontSize*0.75}px;font-weight:bold;color:${sc.textColor};word-break:break-word;">${nome}</div>`:""}</div>`;
    }).join("");
    const win = window.open("","_blank");
    win.document.write(`<html><head><title>Griglia Ombrelloni</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;padding:20px}h2{font-size:18px;color:#0d3b6e;margin-bottom:4px}p{font-size:12px;color:#888;margin-bottom:16px;text-transform:capitalize}.grid{display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:5px;width:fit-content}.legend{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}.leg{display:flex;align-items:center;gap:4px;font-size:11px}.dot{width:8px;height:8px;border-radius:50%}@page{size:landscape;margin:10mm}@media print{body{padding:10px}}</style></head><body><h2>☀️ Stabilimento Balneare — Griglia Ombrelloni</h2><p>${dateLabel}</p><p style="background:#fff3cd;border:1px solid #ffc107;padding:8px 12px;border-radius:6px;color:#856404;font-size:11px;margin-bottom:12px;">📱 Se stampi da cellulare, seleziona <strong>Orizzontale</strong> nelle opzioni di stampa per una migliore visualizzazione.</p><div class="legend"><div class="leg"><div class="dot" style="background:#28a745"></div>Libero</div><div class="leg"><div class="dot" style="background:#dc3545"></div>Occupato</div><div class="leg"><div class="dot" style="background:#ffc107"></div>Prenotato</div><div class="leg"><div class="dot" style="background:#0d6efd"></div>Pagato</div><div class="leg"><div class="dot" style="background:#7b2d8b"></div>Pagato POS</div></div><div class="grid">${cells}</div><script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  };

  const handleSave=(updated)=>{
    setUmbrellas(arr=>arr.map(x=>x.id===updated.id?updated:x));
    setSelected(null); // chiudi modal dopo salvataggio
  };
  const handleCalSave=(updated)=>{setUmbrellas(arr=>arr.map(x=>x.id===updated.id?updated:x));};

  const allRevenue=(status)=>umbrellas.reduce((s,u)=>s+(u.prenotazioni||[]).filter(p=>p.status===status&&(p._single?p.dal===viewDate:dateInRange(viewDate,p.dal,p.al))).reduce((a,p)=>a+parseFloat(p.prezzo||0),0),0);
  const revenueContanti=allRevenue("pagato"), revenuePOS=allRevenue("pagato_pos"), totalRevenue=revenueContanti+revenuePOS;

  const counts={
    libero:    umbrellas.filter(u=>statusOnDate(u,td)==="libero").length,
    occupato:  umbrellas.filter(u=>statusOnDate(u,td)==="occupato").length,
    prenotato: umbrellas.filter(u=>statusOnDate(u,td)==="prenotato").length,
    pagato:    umbrellas.filter(u=>statusOnDate(u,td)==="pagato").length,
    pagato_pos:umbrellas.filter(u=>statusOnDate(u,td)==="pagato_pos").length,
  };

  const filtered=umbrellas.filter(u=>{
    const es=statusOnDate(u,viewDate);
    ;const sq=search.toLowerCase();
    const matchSearch=!sq||String(u.id).includes(sq)||(u.prenotazioni||[]).filter(p=>p._single?p.dal===viewDate:dateInRange(viewDate,p.dal,p.al)).some(p=>(p.nome||"").toLowerCase().includes(sq)||(p.cognome||"").toLowerCase().includes(sq)||(p.telefono||"").toLowerCase().includes(sq));
    return (filter==="tutti"||es===filter)&&matchSearch;
  });

  const activeOnDate=selectedDate?umbrellas.filter(u=>(u.prenotazioni||[]).some(p=>dateInRange(selectedDate,p.dal,p.al))).map(u=>u.id):[];

  const iconBtn=(active)=>({display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:10,border:active?"none":"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.9)",color:"#0d3b6e",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold",transition:"all 0.18s",whiteSpace:"nowrap"});

  const PIN_ADMIN = "2411";
  const PIN_COLLAB = "8080";
  const [pinInput,setPinInput] = useState("");
  const [pinOk,setPinOk] = useState(false);
  const [isAdmin,setIsAdmin] = useState(false);
  const [pinError,setPinError] = useState(false);
  const [pinTentativi,setPinTentativi] = useState(0);
  const [pinBloccato,setPinBloccato] = useState(false);
  const [pinCountdown,setPinCountdown] = useState(0);

  const handlePin = (digit) => {
    if (pinBloccato) return;
    const next = pinInput + digit;
    setPinInput(next);
    setPinError(false);
    if (next.length === 4) {
      if (next === PIN_ADMIN) { setIsAdmin(true); setPinOk(true); setPinTentativi(0); }
      else if (next === PIN_COLLAB) { setIsAdmin(false); setPinOk(true); setPinTentativi(0); }
      else {
        const nuoviTentativi = pinTentativi + 1;
        setPinTentativi(nuoviTentativi);
        setPinError(true);
        if (nuoviTentativi >= 3) {
          setPinBloccato(true);
          setPinCountdown(300); // 5 minuti
          const timer = setInterval(() => {
            setPinCountdown(prev => {
              if (prev <= 1) {
                clearInterval(timer);
                setPinBloccato(false);
                setPinTentativi(0);
                setPinError(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        setTimeout(()=>{ setPinInput(""); setPinError(false); }, 800);
      }
    }
  };

  if (!pinOk) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0d3b6e,#1a5c9a,#2980b9)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif"}}>
      <div style={{background:"rgba(255,255,255,0.1)",borderRadius:24,padding:"40px 36px",width:300,backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.2)",textAlign:"center",animation:"fadeUp 0.3s ease"}}>
        <div style={{fontSize:40,marginBottom:12}}>⛱️</div>
        <div style={{fontSize:20,fontWeight:"bold",color:"#fff",marginBottom:4}}>Stabilimento Balneare</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:28}}>Inserisci il PIN di accesso</div>
        <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:28}}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{width:14,height:14,borderRadius:"50%",background:pinInput.length>i?(pinError?"#dc3545":"#fff"):"rgba(255,255,255,0.3)",transition:"all 0.15s",boxShadow:pinError?"0 0 8px #dc3545":pinInput.length>i?"0 0 8px rgba(255,255,255,0.6)":"none"}}/>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
            <button key={i} onClick={()=>{ if(d==="⌫") setPinInput(p=>p.slice(0,-1)); else if(d!=="") handlePin(String(d)); }}
              style={{padding:"16px 0",borderRadius:12,border:"none",background:d===""?"transparent":pinError?"rgba(220,53,69,0.3)":"rgba(255,255,255,0.15)",color:"#fff",fontSize:20,fontWeight:"bold",cursor:d===""?"default":"pointer",transition:"all 0.15s"}}>
              {d}
            </button>
          ))}
        </div>
        {pinBloccato
          ? <div style={{color:"#ff6b6b",fontSize:13,marginTop:16,background:"rgba(220,53,69,0.2)",borderRadius:10,padding:"10px"}}>
              🔒 Troppi tentativi! Attendi {Math.floor(pinCountdown/60)}:{String(pinCountdown%60).padStart(2,"0")} minuti
            </div>
          : pinError
          ? <div style={{color:"#ff6b6b",fontSize:13,marginTop:16}}>
              PIN errato — {3-pinTentativi} {3-pinTentativi===1?"tentativo rimasto":"tentativi rimasti"}
            </div>
          : null}
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0d3b6e 0%,#1a5c9a 40%,#2980b9 70%,#5dade2 100%)",fontFamily:"'Georgia',serif"}}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .ucell:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 10px 28px rgba(0,0,0,0.22)!important;}
        .ucell{transition:all 0.18s ease;cursor:pointer;}
        input:focus{border-color:#1a5c9a!important;outline:none;}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.25);border-radius:3px}
        input[type=range]{accent-color:#5dade2}.tbtn:hover{background:rgba(255,255,255,0.25)!important;}
      `}</style>

      {/* HEADER */}
      <div style={{padding:"16px 24px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.12)"}}>
        <div>
          <div style={{fontSize:10,letterSpacing:4,color:"rgba(255,255,255,0.55)",textTransform:"uppercase"}}>☀️ Gestione Lido</div>
          <div style={{fontSize:22,fontWeight:"bold",color:"#fff",letterSpacing:-0.5,marginTop:1}}>Stabilimento Balneare</div>
        </div>
      </div>

      {/* TOOLBAR UNICA */}
      <div style={{margin:"0 12px 8px",background:"rgba(255,255,255,0.12)",borderRadius:14,padding:"8px 12px",display:"flex",gap:6,alignItems:"center",flexWrap:"nowrap",overflowX:"auto",border:"1px solid rgba(255,255,255,0.25)"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cerca…"
          style={{...IS,width:160,background:"rgba(255,255,255,0.9)",border:"1px solid rgba(255,255,255,0.4)",color:"#0d3b6e",padding:"8px 12px",fontSize:13,flexShrink:0}}/>
        {search.length>=3 && (()=>{
          const q = search.toLowerCase();
          const allPrens = umbrellas.flatMap(u=>(u.prenotazioni||[]).map(p=>({...p,umbId:u.id})));
          const allSources = [...allPrens, ...(disdette||[])];
          const found = allSources.filter(p=>(p.telefono||"").replace(/\s/g,"").includes(q.replace(/\s/g,""))||
            (p.nome||"").toLowerCase().includes(q)||(p.cognome||"").toLowerCase().includes(q));
          const seen = new Map();
          found.forEach(p=>{
            const k=[p.nome,p.cognome].join("|").toLowerCase();
            const existing=seen.get(k);
            if(!existing||(p.telefono&&!existing.telefono)||p.umbId) seen.set(k,p);
          });
          const unique = [...seen.values()];
          if(unique.length===0) return null;
          return unique.map((p,i)=>{
            const dis = (disdette||[]).find(d=>d.telefono===p.telefono);
            const nome = [p.nome,p.cognome].filter(Boolean).join(" ");
            return (
              <div key={i} style={{background:"rgba(255,255,255,0.95)",borderRadius:10,padding:"8px 12px",marginLeft:4,flexShrink:0,minWidth:180,maxWidth:240,border:"1px solid rgba(255,255,255,0.4)"}}>
                <div style={{fontSize:13,fontWeight:"bold",color:"#1a2e4a"}}>{nome||"—"}</div>
                {p.telefono&&<div style={{fontSize:11,color:"#555"}}>📞 {p.telefono}</div>}
                <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                  {dis&&dis.count>0&&<span style={{background:"#dc3545",color:"#fff",fontSize:10,padding:"2px 8px",borderRadius:20,fontWeight:"bold"}}>⚠️ Disdette: {dis.count}</span>}
                  {(()=>{
                    const normTel = (t)=>(t||"").replace(/\s/g,"").replace(/^\+39/,"");
                    const presenze = umbrellas.flatMap(u=>(u.prenotazioni||[]).filter(pr=>normTel(pr.telefono)===normTel(p.telefono)&&(pr.status==="pagato"||pr.status==="pagato_pos"))).length;
                    return presenze>0?<span style={{background:"#28a745",color:"#fff",fontSize:10,padding:"2px 8px",borderRadius:20,fontWeight:"bold"}}>✅ Presenze: {presenze}</span>:null;
                  })()}
                </div>
                {(()=>{
                  const normTel=(t)=>(t||"").replace(/\s/g,"").replace(/^\+39/,"");
                  const storico = umbrellas.flatMap(u=>(u.prenotazioni||[])
                    .filter(pr=>normTel(pr.telefono)===normTel(p.telefono))
                    .map(pr=>({...pr,umbId:u.id,lettera:String.fromCharCode(65+Math.floor((u.id-1)/cols)),posto:((u.id-1)%cols)+1}))
                  ).sort((a,b)=>b.dal.localeCompare(a.dal)).slice(0,5);
                  if(storico.length===0) return null;
                  const storicoAll = umbrellas.flatMap(u=>(u.prenotazioni||[])
                    .filter(pr=>normTel(pr.telefono)===normTel(p.telefono))
                    .map(pr=>({...pr,umbId:u.id,lettera:String.fromCharCode(65+Math.floor((u.id-1)/cols)),posto:((u.id-1)%cols)+1}))
                  ).sort((a,b)=>b.dal.localeCompare(a.dal));
                  return (
                    <div style={{marginTop:6,borderTop:"1px solid #eee",paddingTop:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <div style={{fontSize:9,color:"#888",letterSpacing:1,textTransform:"uppercase"}}>Storico ({storicoAll.length})</div>
                        {storicoAll.length>3&&<button onClick={()=>setStoricoPopup(p)} style={{fontSize:9,color:"#0d6efd",background:"none",border:"none",cursor:"pointer",padding:0,fontWeight:"bold"}}>Vedi tutto →</button>}
                      </div>
                      {storico.slice(0,3).map((pr,j)=>{
                        const sc=STATUS_COLORS[pr.status];
                        const label=pr._single?isoLabel(pr.dal):`${isoLabel(pr.dal)} → ${isoLabel(pr.al)}`;
                        return (
                          <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,padding:"2px 0",borderBottom:"1px solid #f0f0f0"}}>
                            <span style={{color:"#1a2e4a",fontWeight:"bold"}}>{pr.lettera}{pr.posto}</span>
                            <span style={{color:"#555"}}>{label}</span>
                            <span style={{background:sc.badge,color:"#fff",padding:"1px 5px",borderRadius:8,fontSize:9}}>{sc.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          });
        })()}
        <div style={{width:1,height:22,background:"rgba(255,255,255,0.2)",flexShrink:0}}/>
        {meteo&&meteo[0]&&(
          <div style={{display:"flex",gap:6,alignItems:"center",background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"4px 10px",flexShrink:0}}>
            <img src={`https://openweathermap.org/img/wn/${meteo[0].icon}.png`} style={{width:24,height:24}} alt=""/>
            <span style={{fontSize:13,fontWeight:"bold",color:"#fff"}}>{meteo[0].temp}°C</span>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.7)",textTransform:"capitalize"}}>{meteo[0].desc}</span>
          </div>
        )}
        <button className="tbtn" onClick={()=>window.location.reload()} style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>🔄</span> Aggiorna</button>
        <button className="tbtn" onClick={()=>setShowMsgGiorno(true)} style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>📢</span> Msg Giorno</button>
        {isAdmin&&<button className="tbtn" onClick={()=>setShowGruppi(true)} style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>👥</span> Gruppi</button>}
        {isAdmin&&<button className="tbtn" onClick={()=>setShowDB(true)}      style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>👥</span> Clienti</button>}
        {isAdmin&&<button className="tbtn" onClick={()=>setShowSummary(true)} style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>📊</span> Riepilogo</button>}
        <button className="tbtn" onClick={handlePrintGrid} style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>🖨️</span> Stampa</button>
        {isAdmin&&<button onClick={()=>setShowGrid(true)} style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,padding:"6px 10px",cursor:"pointer",flexShrink:0,color:"#fff"}}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1.2"/><rect x="10" y="0" width="6" height="6" rx="1.2"/><rect x="0" y="10" width="6" height="6" rx="1.2"/><rect x="10" y="10" width="6" height="6" rx="1.2"/></svg>
          <span style={{fontSize:10,fontWeight:"bold"}}>{rows}×{cols}</span>
        </button>}
      </div>

      {/* SELETTORE DATA — sempre visibile sopra la griglia */}
      <div style={{margin:"0 12px 10px",background:"rgba(255,255,255,0.12)",borderRadius:14,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,border:"1px solid rgba(255,255,255,0.25)",overflowX:"auto",flexWrap:"nowrap"}}>
        {/* Freccia indietro */}
        <button onClick={()=>{
          const d=new Date((selectedDate||todayStr())+"T00:00:00");
          d.setDate(d.getDate()-1);
          setSelectedDate(toDateStr(d.getFullYear(),d.getMonth(),d.getDate()));
        }} style={{background:"rgba(255,255,255,0.9)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,color:"#0d3b6e",cursor:"pointer",fontSize:22,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:"bold"}}>‹</button>

        {/* Input data */}
<input type="date" value={selectedDate||todayStr()} onChange={e=>setSelectedDate(e.target.value)} style={{background:"rgba(255,255,255,0.9)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,color:"#0d3b6e",fontSize:15,fontWeight:"bold",flex:1,height:44,textAlign:"center",cursor:"pointer",outline:"none",padding:"0 8px",fontFamily:"inherit"}}/>

        {/* Freccia avanti */}
        <button onClick={()=>{
          const d=new Date((selectedDate||todayStr())+"T00:00:00");
          d.setDate(d.getDate()+1);
          setSelectedDate(toDateStr(d.getFullYear(),d.getMonth(),d.getDate()));
        }} style={{background:"rgba(255,255,255,0.9)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,color:"#0d3b6e",cursor:"pointer",fontSize:22,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:"bold"}}>›</button>

        {/* Oggi */}
        <button onClick={()=>setSelectedDate(todayStr())}
          style={{background:(!selectedDate||selectedDate===todayStr())?"#fff":"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:(!selectedDate||selectedDate===todayStr())?"#0d3b6e":"#fff",cursor:"pointer",fontSize:16,fontWeight:"bold",padding:"0 10px",height:30,flexShrink:0,fontFamily:"inherit"}}>
          Oggi
        </button>

        {/* Label giorno */}
        <div style={{fontSize:14,color:"#fff",flexShrink:0,textTransform:"capitalize",fontWeight:"bold",whiteSpace:"nowrap"}}>
          {new Date((selectedDate||todayStr())+"T00:00:00").toLocaleDateString("it-IT",{weekday:"long"})}
        </div>

        {/* Prenota */}
        
      </div>

      {/* GRIGLIA */}
      <div style={{padding:"0 24px 28px"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:7,fontSize:10,color:"rgba(255,255,255,0.38)",letterSpacing:3,textTransform:"uppercase"}}>
          <span>🌊 Fronte Mare</span><div style={{flex:1,height:1,background:"rgba(255,255,255,0.12)",margin:"0 10px"}}/><span>⬆️ Prima Fila</span>
        </div>
        {scambioId&&(
          <div style={{background:"rgba(255,200,0,0.2)",border:"2px solid #FFD700",borderRadius:12,padding:"8px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"#FFD700",fontWeight:"bold",fontSize:13}}>🔄 Modalità scambio — tocca un altro ombrellone</span>
            <button onClick={()=>setScambioId(null)} style={{background:"none",border:"1px solid #FFD700",borderRadius:8,color:"#FFD700",cursor:"pointer",padding:"4px 10px",fontSize:12}}>Annulla</button>
          </div>
        )}
        <div style={{background:"rgba(255,255,255,0.08)",borderRadius:18,padding:11,border:"1px solid rgba(255,255,255,0.16)",backdropFilter:"blur(8px)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},${cellWidth}px)`,gap:6,minWidth:`${cols*(cellWidth+6)}px`}}>
            {Array.from({length:rows*cols},(_,i)=>{
              const id=i+1, u=umbrellas.find(x=>x.id===id);
              if(!u) return null;
              const es=statusOnDate(u,viewDate);
              const c=STATUS_COLORS[es];
              const vis=filtered.some(x=>x.id===id);
              const act=activeOnDate.includes(id);
              // nome da visualizzare: dalla prenotazione attiva nella viewDate
              const prenView = getPrenForDate(u, viewDate);
              const displayName = prenView ? [prenView.nome,prenView.cognome].filter(Boolean).join(" ") : "";
              
              return (
                <div key={id} className="ucell"
                  onClick={()=>{
                    if(scambioId && scambioId!==id) {
                      // Esegui scambio
                      if(window.confirm(`Scambiare ombrellone ${String.fromCharCode(65+Math.floor((scambioId-1)/cols))}${((scambioId-1)%cols)+1} con ${String.fromCharCode(65+Math.floor((id-1)/cols))}${((id-1)%cols)+1}?`)) {
                        setUmbrellas(prev=>{
                          const n=[...prev];
                          const i1=n.findIndex(x=>x.id===scambioId);
                          const i2=n.findIndex(x=>x.id===id);
                          // Prendi solo la prenotazione del giorno visualizzato
                          const p1=getPrenForDate(n[i1],viewDate);
                          const p2=getPrenForDate(n[i2],viewDate);
                          // Rimuovi la prenotazione del giorno da entrambi e aggiungi quella dell'altro
                          const prens1 = (n[i1].prenotazioni||[]).filter(p=>p.id!==(p1?.id));
                          const prens2 = (n[i2].prenotazioni||[]).filter(p=>p.id!==(p2?.id));
                          if(p1) prens2.push(p1);
                          if(p2) prens1.push(p2);
                          n[i1]={...n[i1],prenotazioni:prens1};
                          n[i2]={...n[i2],prenotazioni:prens2};
                          return n;
                        });
                      }
                      setScambioId(null);
                      return;
                    }
                    const u2=umbrellas.find(x=>x.id===id);
                    const pv=getPrenForDate(u2,viewDate);
                    if(pv) setQuickPopup({umbId:id,prenId:pv.id});
                    else setSelected(id);
                  }}
                  onContextMenu={e=>{ e.preventDefault(); setScambioId(id===scambioId?null:id); }}
                  style={{background:vis?c.bg:"rgba(255,255,255,0.03)",outline:scambioId===id?"3px dashed #fff":scambioId?"3px dashed rgba(255,255,255,0.3)":"none",outlineOffset:"2px",border:(()=>{const gId=prenView?.nota||(disdette||[]).find(d=>d.telefono&&d.telefono===prenView?.telefono)?.gruppoId;const g=(gruppi||[]).find(x=>x.id===gId);return g?`3px solid ${g.colore}`:act?"3px solid #fff":`2px solid ${vis?c.border:"rgba(255,255,255,0.07)"}`})(  ),borderRadius:11,padding:"7px 6px",opacity:vis?1:0.28,height:cellHeight,maxHeight:cellHeight,overflow:"hidden",boxShadow:(()=>{const gId=prenView?.nota||(disdette||[]).find(d=>d.telefono&&d.telefono===prenView?.telefono)?.gruppoId;const g=(gruppi||[]).find(x=>x.id===gId);return g?`0 0 14px ${g.colore}`:act?"0 0 0 3px rgba(255,255,255,0.35)":vis?`0 2px 10px ${c.border}2a`:"none"})(  ),position:"relative"}}>
                  {act&&<div style={{position:"absolute",top:2,right:2,background:"#fff",borderRadius:3,padding:"1px 3px",fontSize:7,color:"#0d3b6e",fontWeight:"bold"}}>📅</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <span style={{fontSize:12}}>⛱️</span>
                    <span style={{background:c.badge,color:"#fff",fontSize:7,padding:"1px 4px",borderRadius:20,fontWeight:"bold",textTransform:"uppercase"}}>{es}</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:"bold",color:"#1a1a1a",marginTop:2,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{String.fromCharCode(65+Math.floor((id-1)/cols))}{((id-1)%cols)+1}</span>{prenView?.lettino&&<span style={{fontSize:14}}>🛏️</span>}</div>
                  {displayName
                    ?<div>
                      <div style={{fontSize:nameFontSize,color:"#1a1a1a",fontWeight:"bold",marginTop:2,whiteSpace:"normal",wordBreak:"break-word",lineHeight:1.2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{displayName}</div><div style={{fontSize:9,color:"#555",fontStyle:"italic",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minHeight:1}}>{[prenView].map(pv=>pv&&pv["nota"]?"🏷️ "+pv["nota"]:"")[0]}</div>
                    </div>
                    :<div style={{fontSize:7,color:"#bbb",marginTop:1}}>—</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",marginTop:7,fontSize:10,color:"rgba(255,255,255,0.38)",letterSpacing:3,textTransform:"uppercase"}}>
          <span>⬇️ Ultima Fila</span><div style={{flex:1,height:1,background:"rgba(255,255,255,0.12)",margin:"0 10px"}}/><span>🏖️ Entrata</span>
        </div>

        {/* NOME STRADA + PEDANE ENTRATA */}
      <div style={{margin:"0 24px 4px",textAlign:"center"}}>
        <span style={{fontSize:12,color:"#fff",letterSpacing:3,textTransform:"uppercase",fontWeight:"bold"}}>Lungolago delle Muse</span>
      </div>
      <div style={{margin:"0 24px",display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:-8}}>
        <div style={{background:"#e8d5a3",borderRadius:"6px 6px 0 0",padding:"6px 28px",fontSize:9,color:"#5a4020",letterSpacing:2,textTransform:"uppercase",border:"1px solid #c4a96a",borderBottom:"none",fontWeight:"bold"}}>
          🪜 Scale
        </div>
        <div style={{background:"#e8d5a3",borderRadius:"6px 6px 0 0",padding:"6px 28px",fontSize:9,color:"#5a4020",letterSpacing:2,textTransform:"uppercase",border:"1px solid #c4a96a",borderBottom:"none",fontWeight:"bold"}}>
          🚪 Entrata Spiaggia
        </div>
      </div>

      {/* STRADA */}
        <div style={{margin:"8px 0",position:"relative"}}>
          {/* Pista ciclabile/pedonale verde - lato ombrelloni */}
          <div style={{background:"#2d5a1b",borderRadius:"4px 4px 0 0",padding:"6px 16px",display:"flex",alignItems:"center",gap:8,borderBottom:"2px dashed #4CAF50"}}>
            <span style={{fontSize:13,letterSpacing:4,display:"flex",justifyContent:"space-between",width:"100%",padding:"0 8px"}}>{"🚶🚴 🚶🚴 🚶🚴 🚶🚴 🚶🚴 🚶🚴 🚶🚴 🚶🚴".split(" ").map((s,i)=><span key={i}>{s}</span>)}</span>
          </div>
          {/* Strada asfaltata */}
          <div style={{background:"#2a2a2a",borderRadius:"0 0 4px 4px",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"1px solid #444",borderTop:"none",boxShadow:"inset 0 2px 8px rgba(0,0,0,0.5)"}}>
            <div style={{flex:1,height:3,background:"repeating-linear-gradient(90deg,#FFD700 0px,#FFD700 30px,transparent 30px,transparent 60px)",opacity:0.7}}/>
            <span style={{margin:"0 12px",fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:3,textTransform:"uppercase",whiteSpace:"nowrap",flexShrink:0}}>🛣️ Strada</span>
            <div style={{flex:1,height:3,background:"repeating-linear-gradient(90deg,#FFD700 0px,#FFD700 30px,transparent 30px,transparent 60px)",opacity:0.7}}/>
          </div>
        </div>
      </div>

      {/* PARCHEGGIO e BAR - sotto strada */}
      <div style={{margin:"0 24px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{background:"#d0d0d0",borderRadius:"0 0 6px 6px",padding:"6px 28px",fontSize:9,color:"#333",letterSpacing:2,textTransform:"uppercase",border:"1px solid #aaa",borderTop:"none",fontWeight:"bold"}}>
          🅿️ Parcheggio
        </div>
        <div style={{background:"#b8e6b8",borderRadius:"0 0 6px 6px",padding:"6px 28px",fontSize:9,color:"#1a5c1a",letterSpacing:2,textTransform:"uppercase",border:"1px solid #8dc88d",borderTop:"none",fontWeight:"bold"}}>
          ☕ Bar
        </div>
      </div>

      {/* MODAL GESTIONE GRUPPI */}
      {showGruppi && (()=>{
        const COLORI_NEON = ["#FF0080","#FF6600","#FFFF00","#00FF41","#00FFFF","#7B00FF","#FF3131","#FF9500","#FF1493","#39FF14","#FF4500","#1F51FF","#CCFF00","#FF69B4","#00FF7F","#FF2D55","#FFD700","#BF00FF","#FF6EC7","#00BFFF"];

        return (
          <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5000}}>
            <div style={{background:"#fff",borderRadius:24,padding:"28px 24px",width:440,maxWidth:"95vw",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 40px 100px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a"}}>👥 Gestione Gruppi</div>
                <button onClick={()=>setShowGruppi(false)} style={{background:"#f0f0f0",border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16}}>×</button>
              </div>
              {/* Lista gruppi */}
              <div style={{overflowY:"auto",flex:1,marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>
                {(gruppi||[]).length===0&&<div style={{textAlign:"center",padding:"20px",color:"#aaa"}}>Nessun gruppo ancora</div>}
                {(gruppi||[]).map(g=>(
                  <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#f8faff",borderRadius:12,border:`2px solid ${g.colore}`,boxShadow:`0 0 8px ${g.colore}44`}}>
                    <div style={{width:20,height:20,borderRadius:6,background:g.colore,flexShrink:0,boxShadow:`0 0 8px ${g.colore}`}}/>
                    <div style={{flex:1,fontWeight:"bold",color:"#1a2e4a"}}>{g.nome}</div>
                    <button onClick={()=>setGruppi(prev=>prev.filter(x=>x.id!==g.id))}
                      style={{padding:"4px 10px",borderRadius:8,border:"1px solid #dc3545",background:"#fff",color:"#dc3545",cursor:"pointer",fontSize:12}}>🗑️</button>
                  </div>
                ))}
              </div>
              {/* Aggiungi nuovo gruppo */}
              <div style={{borderTop:"1px solid #eee",paddingTop:16}}>
                <div style={{fontSize:11,color:"#888",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Aggiungi gruppo</div>
                <input value={nuovoNome} onChange={e=>setNuovoNome(e.target.value)} placeholder="Nome gruppo (es. Famiglia Rossi)" style={{...IS,marginBottom:10}}/>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                  {COLORI_NEON.map(col=>(
                    <button key={col} onClick={()=>setNuovoColore(col)} style={{width:28,height:28,borderRadius:6,border:nuovoColore===col?"3px solid #333":"2px solid transparent",background:col,cursor:"pointer",boxShadow:`0 0 8px ${col}`}}/>
                  ))}
                </div>
                <button onClick={()=>{
                  if(!nuovoNome.trim()) return;
                  setGruppi(prev=>[...prev,{id:Date.now().toString(),nome:nuovoNome.trim(),colore:nuovoColore}]);
                  setNuovoNome("");
                }} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:"bold"}}>
                  + Aggiungi Gruppo
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {storicoPopup && (()=>{
        const normTel=(t)=>(t||"").replace(/\s/g,"").replace(/^\+39/,"");
        const nome=[storicoPopup.nome,storicoPopup.cognome].filter(Boolean).join(" ");
        const storicoAll = umbrellas.flatMap(u=>(u.prenotazioni||[])
          .filter(pr=>normTel(pr.telefono)===normTel(storicoPopup.telefono))
          .map(pr=>({...pr,umbId:u.id,lettera:String.fromCharCode(65+Math.floor((u.id-1)/cols)),posto:((u.id-1)%cols)+1}))
        ).sort((a,b)=>b.dal.localeCompare(a.dal));
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:6000}} onClick={()=>setStoricoPopup(null)}>
            <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,padding:"24px",width:420,maxWidth:"95vw",maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{fontSize:16,fontWeight:"bold",color:"#1a2e4a"}}>📅 Storico {nome}</div>
                  <div style={{fontSize:12,color:"#888"}}>{storicoAll.length} prenotazioni totali</div>
                </div>
                <button onClick={()=>setStoricoPopup(null)} style={{background:"#f0f0f0",border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16}}>×</button>
              </div>
              <div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:6}}>
                {storicoAll.map((pr,j)=>{
                  const sc=STATUS_COLORS[pr.status];
                  const label=pr._single?isoLabel(pr.dal):`${isoLabel(pr.dal)} - ${isoLabel(pr.al)}`;
                  return (
                    <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#f8faff",borderRadius:10,border:"1px solid #e8eeff"}}>
                      <span style={{fontSize:14,fontWeight:"bold",color:"#1a2e4a"}}>{pr.lettera}{pr.posto}</span>
                      <span style={{fontSize:12,color:"#555"}}>{label}</span>
                      <span style={{background:sc.badge,color:"#fff",padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:"bold"}}>{sc.text}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8,marginTop:16}}>
                <button onClick={()=>setStoricoPopup(null)} style={{flex:1,padding:"12px",borderRadius:12,border:"2px solid #eee",background:"#fff",color:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:14}}>Chiudi</button>
                {storicoPopup.telefono&&(
                  <a href={`https://wa.me/39${storicoPopup.telefono.replace(/\s/g,"").replace(/^\+39/,"")}?text=${encodeURIComponent(
                    "Gentile "+nome+", ecco il riepilogo delle Sue prenotazioni per la stagione:\n\n"+
                    storicoAll.filter(pr=>pr.status==="prenotato"&&pr.dal>=new Date().toISOString().slice(0,10)).map(pr=>{const label=pr._single?isoLabel(pr.dal):isoLabel(pr.dal)+" - "+isoLabel(pr.al);return "⛱️ Ombrellone "+pr.lettera+pr.posto+" — "+label;}).join("\n")+"\n\nGrazie per aver scelto il nostro stabilimento! ☀️"

                  )}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{flex:2,padding:"12px",borderRadius:12,border:"none",background:"#25D366",color:"#fff",textDecoration:"none",fontFamily:"inherit",fontSize:14,fontWeight:"bold",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    💬 Invia storico
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {quickPopup && (()=>{
        const u = umbrellas.find(x=>x.id===quickPopup.umbId);
        const p = (u?.prenotazioni||[]).find(x=>x.id===quickPopup.prenId);
        if(!u||!p) return null;
        const label = p._single ? isoLabel(p.dal) : isoLabel(p.dal)+" -> "+isoLabel(p.al);
        const fila = Math.ceil(u.id/cols);
        const posto = ((u.id-1)%cols)+1;
        const lettera = String.fromCharCode(65+Math.floor((u.id-1)/cols));
        const handleUpdatePren = (key,val) => {
          const updated = umbrellas.map(umb => umb.id!==u.id ? umb : {...umb, prenotazioni:(umb.prenotazioni||[]).map(pr => pr.id!==p.id ? pr : {...pr,[key]:val})});
          setUmbrellas(updated);
        };
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000}} onClick={()=>setQuickPopup(null)}>
            <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,padding:"24px 20px 28px",width:360,maxWidth:"95vw",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a"}}>{lettera}{posto}</div>
                  <div style={{fontSize:14,fontWeight:"bold",color:"#555",marginTop:2}}>Fila {fila} · {label}</div>
                  {[p.nome,p.cognome].filter(Boolean).length>0&&<div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a",marginTop:4}}>👤 {[p.nome,p.cognome].filter(Boolean).join(" ")}</div>}{p.telefono&&<div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a",marginTop:3}}>📞 {p.telefono}</div>}{p.nota&&<div style={{fontSize:13,color:"#666",fontStyle:"italic",marginTop:3}}>🏷️ {p.nota}</div>}
                </div>
                <button onClick={()=>setQuickPopup(null)} style={{background:"#f0f0f0",border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16}}>x</button>
              </div>
              <div style={{fontSize:11,color:"#888",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Stato</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                {Object.entries(STATUS_COLORS).filter(([k])=>k!=="libero").map(([k,v])=>(
                  <button key={k} onClick={()=>handleUpdatePren("status",k)}
                    style={{padding:"14px 8px",borderRadius:12,border:`2px solid ${p.status===k?v.border:"#eee"}`,background:p.status===k?v.bg:"#fafafa",color:p.status===k?v.badge:"#999",fontSize:14,cursor:"pointer",fontWeight:p.status===k?"bold":"normal",textAlign:"center"}}>
                    {v.text}
                  </button>
                ))}
              </div>
              <div style={{fontSize:11,color:"#888",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>💳 Importo</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
                {[5,10,15,20,25,30].map(i=>(
                  <button key={i} onClick={()=>handleUpdatePren("prezzo",String(i))} style={{padding:"14px 0",borderRadius:10,border:`2px solid ${p.prezzo===String(i)?"#0d6efd":"#eee"}`,background:p.prezzo===String(i)?"#0d6efd":"#fafafa",color:p.prezzo===String(i)?"#fff":"#555",fontSize:16,cursor:"pointer",fontWeight:"bold"}}>€{i}</button>
                ))}
              </div>
              <input type="number" value={p.prezzo||""} onChange={e=>handleUpdatePren("prezzo",e.target.value)}
                placeholder="€ Altro importo" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"2px solid #e8e8e8",fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",color:"#1a2e4a",marginBottom:12}}/>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>{
                  if(!window.confirm("Cancellare la prenotazione senza registrare disdetta?")) return;
                  setUmbrellas(umbrellas.map(umb=>umb.id!==u.id?umb:{...umb,prenotazioni:(umb.prenotazioni||[]).filter(pr=>pr.id!==p.id)}));
                  setQuickPopup(null);
                }} style={{flex:1,padding:"12px 0",borderRadius:12,border:"2px solid #888",background:"#fff",color:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>
                  🗑️ Cancella
                </button>
                <button onClick={()=>{
                  const key=[p.nome,p.cognome,p.telefono].filter(Boolean).join("|");
                  setDisdette(prev=>{const idx=prev.findIndex(d=>[d.nome,d.cognome,d.telefono].filter(Boolean).join("|")===key);if(idx>=0){const n=[...prev];n[idx]={...n[idx],nome:p.nome,cognome:p.cognome,telefono:p.telefono,indirizzo:p.indirizzo,cf:p.cf,count:(n[idx].count||0)+1};return n;}return [...prev,{nome:p.nome,cognome:p.cognome,telefono:p.telefono,indirizzo:p.indirizzo,cf:p.cf,count:1}];});
                  setUmbrellas(umbrellas.map(umb=>umb.id!==u.id?umb:{...umb,prenotazioni:(umb.prenotazioni||[]).filter(pr=>pr.id!==p.id)}));
                  setQuickPopup(null);
                  // Messaggio WhatsApp di disdetta
                  if(p.telefono) {
                    const nome=[p.nome,p.cognome].filter(Boolean).join(" ");
                    const lettera=String.fromCharCode(65+Math.floor((u.id-1)/cols));
                    const posto=((u.id-1)%cols)+1;
                    const fila=Math.ceil(u.id/cols);
                    const label=p._single?isoLabel(p.dal):`${isoLabel(p.dal)} - ${isoLabel(p.al)}`;
                    const msg=`Gentile ${nome}, la Sua prenotazione all'ombrellone ${lettera}${posto} (Fila ${fila}, Posto ${posto}) per il ${label} è stata annullata.

Siamo spiacenti per l'inconveniente. La aspettiamo presto! ☀️`;
                    const url=`https://wa.me/39${p.telefono.replace(/\s/g,"").replace(/^\+39/,"")}?text=${encodeURIComponent(msg)}`;
                    setTimeout(()=>{ if(window.confirm(`Inviare messaggio di disdetta a ${nome}?`)) window.open(url,"_blank"); }, 300);
                  }
                }} style={{flex:1,padding:"12px 0",borderRadius:12,border:"2px solid #dc3545",background:"#fff",color:"#dc3545",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>
                  Disdice
                </button>
                <button onClick={()=>{setQuickPopup(null);setSelected(quickPopup.umbId);}}
                  style={{flex:1,padding:"12px 0",borderRadius:12,border:"2px solid #0d6efd",background:"#e8f0ff",color:"#0d6efd",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>
                  Prenotazioni
                </button>
                <button 
                  onClick={()=>{
                    if((p.status==="pagato"||p.status==="pagato_pos")&&!p.prezzo){
                      alert("Inserisci l'importo prima di salvare!");
                      return;
                    }
                    setQuickPopup(null);
                  }}
                  style={{flex:1,padding:"12px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>
                  Fatto
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {selected!=null && umbrellas.find(x=>x.id===selected) && (
        <UmbrellaModal
          umbrella={umbrellas.find(x=>x.id===selected)}
          allUmbrellas={umbrellas}
          viewDate={viewDate}
          cols={cols}
          disdette={disdette||[]}
          gruppi={gruppi||[]}
          onSave={handleSave}
          onUpdateGruppoCliente={(tel,gid)=>setDisdette(prev=>{const idx=prev.findIndex(d=>d.telefono===tel);if(idx>=0){const n=[...prev];n[idx]={...n[idx],gruppoId:gid};return n;}return [...prev,{telefono:tel,gruppoId:gid,count:0}];})}
          onClose={()=>setSelected(null)}
        />
      )}
      {/* MODAL MESSAGGIO DEL GIORNO */}
      {showMsgGiorno && (()=>{
        const dateLabel = new Date(viewDate+"T00:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"});
        const clientiOggi = umbrellas
          .map(u=>{ const p=getPrenForDate(u,viewDate); return p&&p.telefono&&p.status==="prenotato"?{...p,umbId:u.id}:null; })
          .filter(Boolean)
          .filter((p,i,arr)=>arr.findIndex(x=>x.telefono===p.telefono)===i)
          .filter(p=>!msgInviati.includes(p.telefono)); // escludi già inviati
        const fila = (id)=>Math.ceil(id/cols);
        const posto = (id)=>((id-1)%cols)+1;
        const lettera = (id)=>String.fromCharCode(65+Math.floor((id-1)/cols));
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5000}}>
            <div style={{background:"#fff",borderRadius:24,padding:"28px 24px",width:420,maxWidth:"95vw",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 40px 100px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a"}}>📢 Promemoria del giorno</div>
                  <div style={{fontSize:12,color:"#888",marginTop:2,textTransform:"capitalize"}}>{dateLabel} — {clientiOggi.length} prenotati con telefono</div>
                </div>
                <button onClick={()=>setShowMsgGiorno(false)} style={{background:"#f0f0f0",border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16}}>×</button>
              </div>
              <div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:8}}>
                {clientiOggi.length===0
                  ? <div style={{textAlign:"center",padding:"30px",color:"#aaa"}}>Nessun prenotato con telefono per oggi</div>
                  : clientiOggi.map((p)=>{
                    const nome=[p.nome,p.cognome].filter(Boolean).join(" ");
                    const omb=`${lettera(p.umbId)}${posto(p.umbId)}`;
                    const msg=`Gentile ${nome}, le ricordiamo la Sua prenotazione di oggi ${dateLabel} all'ombrellone ${omb} (Fila ${fila(p.umbId)}, Posto ${posto(p.umbId)}). La aspettiamo! ☀️

⏰ Ricordiamo che la prenotazione è riservata fino alle ore 12:00.`;
                    return (
                      <div key={p.telefono||i} style={{background:"#f8faff",borderRadius:12,padding:"12px 14px",border:"1px solid #e8eeff",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                        <div>
                          <div style={{fontWeight:"bold",color:"#1a2e4a",fontSize:14}}>{nome}</div>
                          <div style={{fontSize:12,color:"#888"}}>⛱️ {omb} · 📞 {p.telefono}</div>
                        </div>
                        <a href={`https://wa.me/39${p.telefono.replace(/\s/g,"").replace(/^\+39/,"")}?text=${encodeURIComponent(msg)}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={()=>{ const next=[...msgInviati,p.telefono]; setMsgInviati(next); localStorage.setItem("msgInviati",JSON.stringify({date:new Date().toISOString().slice(0,10),tels:next})); }}
                          style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#25D366",color:"#fff",textDecoration:"none",fontSize:13,fontWeight:"bold",flexShrink:0,whiteSpace:"nowrap"}}>
                          💬 Invia
                        </a>
                      </div>
                    );
                  })
                }
              </div>
              <div style={{display:"flex",gap:8,marginTop:16}}>
                <button onClick={()=>setShowMsgGiorno(false)} style={{flex:1,padding:"12px",borderRadius:12,border:"2px solid #eee",background:"#fff",color:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:14}}>Chiudi</button>

              </div>
            </div>
          </div>
        );
      })()}

      {showGrid    && <GridSettingsModal rows={rows} cols={cols} fontSize={nameFontSize} cellHeight={cellHeight} cellWidth={cellWidth} onApply={handleApplyGrid} onClose={()=>setShowGrid(false)}/>}
      {showDB      && <DatabaseModal umbrellas={umbrellas} disdette={disdette||[]} onSaveUmbrellas={(updated)=>setUmbrellas(updated)} onClose={()=>setShowDB(false)}/>}
      {showCal     && <CalendarView umbrellas={umbrellas} selectedDate={selectedDate} onSelectDate={setSelectedDate} onSave={handleCalSave} onClose={()=>setShowCal(false)} cols={cols} cellWidth={cellWidth} cellHeight={cellHeight} nameFontSize={nameFontSize}/>}
      {showSummary && (
        <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5000}}>
          <div style={{background:"#fff",borderRadius:24,padding:"28px 32px",width:460,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 40px 100px rgba(0,0,0,0.3)",fontFamily:"'Georgia',serif",animation:"fadeUp 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
              <div>
                <div style={{fontSize:10,letterSpacing:3,color:"#888",textTransform:"uppercase",marginBottom:3}}>📊 Situazione</div>
                <div style={{fontSize:20,fontWeight:"bold",color:"#1a2e4a",textTransform:"capitalize"}}>
                  {new Date(viewDate+"T00:00:00").toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                </div>
              </div>
              <button onClick={()=>setShowSummary(false)} style={{...SB,background:"#f0f0f0",border:"none",fontSize:18,color:"#555"}}>×</button>
            </div>

            {/* Contatori stato */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              {[
                {label:"Liberi",     count:counts.libero,     bg:"#d4edda",border:"#28a745",color:"#155724",dot:"#28a745"},
                {label:"Occupati",   count:counts.occupato,   bg:"#f8d7da",border:"#dc3545",color:"#721c24",dot:"#dc3545"},
                {label:"Prenotati",  count:counts.prenotato,  bg:"#fff3cd",border:"#ffc107",color:"#856404",dot:"#ffc107"},
                {label:"Pagati",     count:counts.pagato,     bg:"#cce5ff",border:"#0d6efd",color:"#004085",dot:"#0d6efd"},
                {label:"Pagati POS", count:counts.pagato_pos, bg:"#e8d5f5",border:"#7b2d8b",color:"#4a1060",dot:"#7b2d8b"},
                {label:"Totale",     count:rows*cols,          bg:"#f5f5f5",border:"#aaa",   color:"#333",   dot:"#aaa"},
              ].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:10,background:s.bg,borderRadius:12,padding:"12px 14px",border:`1px solid ${s.border}`}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:s.dot,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:22,fontWeight:"bold",color:s.color,lineHeight:1}}>{s.count}</div>
                    <div style={{fontSize:11,color:s.color,opacity:0.8,marginTop:2}}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Incassi */}
            <div style={{background:"#f5f8ff",borderRadius:14,padding:"14px 16px",border:"1px solid #e8eeff"}}>
              <div style={{fontSize:10,letterSpacing:2,color:"#0d6efd",textTransform:"uppercase",fontWeight:"bold",marginBottom:12}}>💰 Incassi Totali</div>
              <div style={{fontSize:28,fontWeight:"bold",color:"#1a2e4a",marginBottom:10}}>€ {totalRevenue.toFixed(2)}</div>
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1,background:"#cce5ff",borderRadius:10,padding:"10px 14px",border:"1px solid #0d6efd"}}>
                  <div style={{fontSize:11,color:"#004085",marginBottom:3}}>💵 Contanti</div>
                  <div style={{fontSize:18,fontWeight:"bold",color:"#004085"}}>€ {revenueContanti.toFixed(2)}</div>
                </div>
                <div style={{flex:1,background:"#e8d5f5",borderRadius:10,padding:"10px 14px",border:"1px solid #7b2d8b"}}>
                  <div style={{fontSize:11,color:"#4a1060",marginBottom:3}}>💳 POS</div>
                  <div style={{fontSize:18,fontWeight:"bold",color:"#4a1060"}}>€ {revenuePOS.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
