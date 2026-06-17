import { useState, useEffect, useRef } from "react";
import { db, saveUmbrellas, subscribeUmbrellas } from "./firebase";

// ── COSTANTI COLORI ───────────────────────────────────────────────
const STATUS_COLORS = {
  libero:     { bg:"#d4edda", border:"#28a745", badge:"#155724", text:"Libero",      textColor:"#155724", dot:"#28a745" },
  occupato:   { bg:"#f8d7da", border:"#dc3545", badge:"#721c24", text:"Occupato",    textColor:"#721c24", dot:"#dc3545" },
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
function UmbrellaModal({ umbrella, allUmbrellas, onSave, onClose }) {
  const td = todayStr();

  // Dati cliente per il form: presi SOLO dalla prenotazione attiva oggi
  // Se oggi è libero → campi vuoti (nuovo cliente)
  const todayPren = getPrenForDate(umbrella, td);
  const emptyClient = { nome:"", cognome:"", indirizzo:"", telefono:"", cf:"" };
  const clientFromToday = todayPren
    ? { nome:todayPren.nome||"", cognome:todayPren.cognome||"", indirizzo:todayPren.indirizzo||"", telefono:todayPren.telefono||"", cf:todayPren.cf||"" }
    : emptyClient;

  const [client,setClient] = useState(clientFromToday);
  const setC = (k,v) => setClient(f=>({...f,[k]:v}));

  // ogni prenotazione porta i suoi dati cliente dentro di sé
  const [prenList,setPrenList] = useState(umbrella.prenotazioni ? umbrella.prenotazioni.map(p=>({...p})) : []);

  const [selMode,setSelMode] = useState("singoli");
  const [rangeStart,setRangeStart] = useState(null);
  const [pendingStatus,setPendingStatus] = useState("prenotato");
  const [pendingPrezzo,setPendingPrezzo] = useState("");

  const [suggestions,setSuggestions] = useState([]);
  const findMatches=(nome,cognome)=>{
    const q=(nome+" "+cognome).trim().toLowerCase();
    if(q.length<2) return [];
    // cerca tra tutte le prenotazioni di tutti gli ombrelloni
    const all = allUmbrellas.flatMap(u=>(u.prenotazioni||[]).map(p=>({...p, _umbId:u.id})));
    const seen = new Set();
    return all.filter(p=>{
      const fn = [p.nome,p.cognome].filter(Boolean).join(" ").toLowerCase();
      if(!fn.includes(q.split(" ")[0]) && !fn.includes(q)) return false;
      if(seen.has(fn)) return false;
      seen.add(fn); return true;
    }).slice(0,4);
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
    // Sovrascrive SEMPRE i dati cliente con quelli del form su tutte le prenotazioni
    const updatedPrenList = prenList.map(p => ({
      ...p,
      nome:      client.nome,
      cognome:   client.cognome,
      indirizzo: client.indirizzo,
      telefono:  client.telefono,
      cf:        client.cf,
    }));
    onSave({...umbrella, prenotazioni: updatedPrenList});
  };

  const deletePren = (id) => setPrenList(l=>l.filter(p=>p.id!==id));
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

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

          {/* COLONNA SX */}
          <div>
            {/* Dati cliente */}
            <div style={{background:"#f8faff",borderRadius:14,padding:"14px 16px",marginBottom:14,border:"1px solid #e8eeff"}}>
              <div style={{fontSize:10,letterSpacing:2,color:"#0d6efd",textTransform:"uppercase",fontWeight:"bold",marginBottom:10}}>👤 Dati Cliente</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <div style={{flex:1}}><label style={LS}>Nome</label>
                  <input value={client.nome} onChange={e=>{setC("nome",e.target.value);setSuggestions(findMatches(e.target.value,client.cognome));}} placeholder="Mario" style={IS}/>
                </div>
                <div style={{flex:1}}><label style={LS}>Cognome</label>
                  <input value={client.cognome} onChange={e=>{setC("cognome",e.target.value);setSuggestions(findMatches(client.nome,e.target.value));}} placeholder="Rossi" style={IS}/>
                </div>
              </div>
              {suggestions.length>0&&(
                <div style={{marginBottom:8,border:"1px solid #0d6efd",borderRadius:10,overflow:"hidden"}}>
                  <div style={{padding:"5px 10px",background:"#e8f0ff",fontSize:10,color:"#0d6efd",fontWeight:"bold",letterSpacing:1,textTransform:"uppercase"}}>👤 Cliente esistente</div>
                  {suggestions.map((u,i)=>(
                    <div key={i} onClick={()=>{setClient({nome:u.nome,cognome:u.cognome,indirizzo:u.indirizzo,telefono:u.telefono});setSuggestions([]);}}
                      style={{padding:"6px 12px",background:"#fff",borderTop:"1px solid #e8eeff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}>
                      <strong style={{color:"#1a2e4a"}}>{fullName(u)}</strong>
                      {u.telefono&&<span style={{color:"#888",fontSize:11}}>📞 {u.telefono}</span>}
                      <span style={{fontSize:11,color:"#0d6efd",fontWeight:"bold"}}>Usa →</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{marginBottom:8}}><label style={LS}>Indirizzo</label><input value={client.indirizzo} onChange={e=>setC("indirizzo",e.target.value)} placeholder="Via Roma 12, Milano" style={IS}/></div>
              <div style={{marginBottom:8}}>
                <label style={LS}>Telefono</label>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input value={client.telefono} onChange={e=>setC("telefono",e.target.value)} placeholder="333 1234567" type="tel" style={{...IS,flex:1}}/>
                  {client.telefono&&(
                    <a href={`tel:${client.telefono.replace(/\s/g,"")}`}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",width:38,height:38,borderRadius:10,background:"#28a745",color:"#fff",textDecoration:"none",fontSize:18,flexShrink:0}}
                      title={`Chiama ${client.telefono}`}>📞</a>
                  )}
                </div>
              </div>
              <div><label style={LS}>Codice Fiscale</label><input value={client.cf||""} onChange={e=>setC("cf",e.target.value.toUpperCase())} placeholder="RSSMRA80A01H501Z" style={{...IS,letterSpacing:1}} maxLength={16}/></div>
            </div>

            {/* Lista prenotazioni */}
            <div>
              <div style={{fontSize:10,letterSpacing:2,color:"#856404",textTransform:"uppercase",fontWeight:"bold",marginBottom:8}}>📅 Prenotazioni ({prenList.length})</div>
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
                      <div key={p.id} style={{borderRadius:10,border:`1px solid ${sc2.border}`,background:sc2.bg,padding:"8px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                          <div>
                            <div style={{fontSize:11,fontWeight:"bold",color:sc2.textColor}}>
                              {p._single&&<span style={{fontSize:10,opacity:0.7,marginRight:5}}>📌</span>}{label}
                            </div>
                            {pClient&&<div style={{fontSize:10,color:sc2.textColor,opacity:0.8}}>👤 {pClient}</div>}
                          </div>
                          <button onClick={()=>deletePren(p.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc3545",fontSize:16,padding:0}}>×</button>
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
                <input type="number" value={pendingPrezzo} onChange={e=>setPendingPrezzo(e.target.value)}
                  placeholder="€ Prezzo (opzionale)" style={{...IS,padding:"5px 10px",fontSize:11}}/>
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
function GridSettingsModal({ rows, cols, onApply, onClose }) {
  const [r,setR]=useState(rows);const [c,setC]=useState(cols);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(10,20,40,0.6)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000}}>
      <div style={{background:"#fff",borderRadius:20,padding:"28px 32px",width:350,boxShadow:"0 30px 80px rgba(0,0,0,0.3)",fontFamily:"'Georgia',serif",animation:"fadeUp 0.22s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:"bold",color:"#1a2e4a"}}>Dimensione Griglia</div>
          <button onClick={onClose} style={{...SB,background:"#f0f0f0",border:"none",fontSize:18,color:"#555"}}>×</button>
        </div>
        {[["File",r,setR],["Colonne",c,setC]].map(([label,val,setVal])=>(
          <div key={label} style={{marginBottom:16}}>
            <label style={LS}>{label} — {val}</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>setVal(v=>Math.max(1,v-1))} style={SB}>−</button>
              <div style={{flex:1,textAlign:"center",fontSize:26,fontWeight:"bold",color:"#1a2e4a",background:"#f5f8ff",borderRadius:10,padding:"7px 0"}}>{val}</div>
              <button onClick={()=>setVal(v=>Math.min(20,v+1))} style={SB}>+</button>
            </div>
            <input type="range" min={1} max={20} value={val} onChange={e=>setVal(Number(e.target.value))} style={{width:"100%",marginTop:7,accentColor:"#1a5c9a"}}/>
          </div>
        ))}
        <div style={{background:"#f0f7ff",borderRadius:10,padding:"9px",marginBottom:16,fontSize:12,color:"#1a5c9a",textAlign:"center"}}>
          Totale: <strong>{r*c}</strong> ombrelloni {r*c!==rows*cols&&<span style={{color:"#e65100",marginLeft:5}}>({r*c>rows*cols?"+":"-"}{Math.abs(r*c-rows*cols)})</span>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"10px 0",borderRadius:12,border:"2px solid #e0e0e0",background:"#fff",color:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Annulla</button>
          <button onClick={()=>onApply(r,c)} style={{flex:2,padding:"10px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>Applica</button>
        </div>
      </div>
    </div>
  );
}

// ── DATABASE CLIENTI ─────────────────────────────────────────────
function DatabaseModal({ umbrellas, onClose }) {
  const [search,setSearch] = useState("");
  const rows = umbrellas
    .filter(u=>u.prenotazioni&&u.prenotazioni.length>0)
    .flatMap(u=>u.prenotazioni
      .filter(p=>p.nome||p.cognome||p.telefono)
      .map(p=>({...p, umbId:u.id}))
    )
    .filter(r=>{ const q=search.toLowerCase(); return !q||[r.nome,r.cognome,r.telefono,r.indirizzo].join(" ").toLowerCase().includes(q); })
    .sort((a,b)=>(a.cognome||"").localeCompare(b.cognome||""));

  const handlePrint=()=>{
    const trs=rows.map(r=>`<tr>
      <td>#${r.umbId}</td>
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
      <thead><tr><th>Omb.</th><th>Cognome</th><th>Nome</th><th>Indirizzo</th><th>Telefono</th><th>Cod. Fiscale</th></tr></thead>
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
            <div style={{fontSize:12,color:"#888",marginTop:2}}>{rows.length} prenotazioni</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handlePrint} style={{display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:"bold"}}>🖨️ Stampa / PDF</button>
            <button onClick={onClose} style={{...SB,background:"#f0f0f0",border:"none",fontSize:18,color:"#555"}}>×</button>
          </div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cerca per nome, cognome, telefono…" style={{...IS,marginBottom:16,flexShrink:0}}/>
        <div style={{overflowY:"auto",flex:1}}>
          {rows.length===0?<div style={{textAlign:"center",padding:"40px 0",color:"#aaa"}}>Nessun cliente trovato</div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#f5f8ff",position:"sticky",top:0}}>
                  {["Omb.","Cognome","Nome","Indirizzo","Telefono","Cod. Fiscale"].map(h=>(
                    <th key={h} style={{padding:"9px 10px",textAlign:"left",fontSize:10,letterSpacing:1,color:"#888",textTransform:"uppercase",fontWeight:"bold",borderBottom:"2px solid #eee",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>{
                  return (
                    <tr key={r.umbId+"-"+r.id} style={{background:i%2===0?"#fff":"#fafafa"}}>
                      <td style={{padding:"9px 10px",fontWeight:"bold",color:"#1a2e4a"}}>#{r.umbId}</td>
                      <td style={{padding:"9px 10px",fontWeight:"bold",color:"#1a2e4a"}}>{r.cognome||"—"}</td>
                      <td style={{padding:"9px 10px"}}>{r.nome||"—"}</td>
                      <td style={{padding:"9px 10px",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.indirizzo||"—"}</td>
                      <td style={{padding:"9px 10px",whiteSpace:"nowrap"}}>{r.telefono||"—"}</td>
                      <td style={{padding:"9px 10px",fontFamily:"monospace",fontSize:12,letterSpacing:1}}>{r.cf||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CALENDARIO PRINCIPALE ─────────────────────────────────────────
function CalendarView({ umbrellas, selectedDate, onSelectDate, onSave, onClose }) {
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

  const getForDay=(ds)=>umbrellas.filter(u=>(u.prenotazioni||[]).some(p=>dateInRange(ds,p.dal,p.al)));
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
                    return <div key={u.id} style={{fontSize:8,padding:"1px 4px",borderRadius:5,marginBottom:1,background:sc.bg,color:sc.textColor,border:`1px solid ${sc.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:"bold"}}>#{u.id} {fullName(u)}</div>;
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
            <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.round(Math.sqrt(umbrellas.length*2))},minmax(0,1fr))`,gap:6}}>
              {umbrellas.map(u=>{
                const es=statusOnDate(u,bookingDate);
                const c=STATUS_COLORS[es];
                return (
                  <div key={u.id} className="ucell" onClick={()=>setEditUmb(u)}
                    style={{background:c.bg,border:`2px solid ${c.border}`,borderRadius:11,padding:"7px 6px",minHeight:68,boxShadow:`0 2px 8px ${c.border}33`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <span style={{fontSize:12}}>⛱️</span>
                      <span style={{background:c.badge,color:"#fff",fontSize:7,padding:"1px 4px",borderRadius:20,fontWeight:"bold",textTransform:"uppercase"}}>{es}</span>
                    </div>
                    <div style={{fontSize:11,fontWeight:"bold",color:c.textColor,marginTop:2}}>#{u.id}</div>
                    {es!=="libero"&&fullName(u)!=="—"?<div style={{fontSize:8,color:c.textColor,fontWeight:"bold",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fullName(u)}</div>:<div style={{fontSize:7,color:"rgba(0,0,0,0.25)",marginTop:1}}>libero</div>}
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
  const [showCal,setShowCal]     = useState(false);
  const [showDB,setShowDB]       = useState(false);
  const [showSummary,setShowSummary] = useState(false);
  const [selectedDate,setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    const unsub = subscribeUmbrellas(db, (data) => {
      if (data && data.length > 0) {
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
      saveUmbrellas(db, umbrellas).finally(() => setSaving(false));
    }, 800);
    return () => clearTimeout(t);
  }, [umbrellas]);


  const td = todayStr();
  const viewDate = selectedDate || td;

  const handleApplyGrid=(nr,nc)=>{
    const t=nr*nc;
    setUmbrellas(prev=>{
      if(t>prev.length){const ex=Array.from({length:t-prev.length},(_,i)=>({id:prev.length+i+1,nome:"",cognome:"",indirizzo:"",telefono:"",prenotazioni:[]}));return[...prev,...ex];}
      return prev.slice(0,t);
    });
    setRows(nr);setCols(nc);setShowGrid(false);
  };
  const handleSave=(updated)=>{
    setUmbrellas(arr=>arr.map(x=>x.id===updated.id?updated:x));
    setSelected(null); // chiudi modal dopo salvataggio
  };
  const handleCalSave=(updated)=>{setUmbrellas(arr=>arr.map(x=>x.id===updated.id?updated:x));};

  const allRevenue=(status)=>umbrellas.reduce((s,u)=>s+(u.prenotazioni||[]).filter(p=>p.status===status).reduce((a,p)=>a+parseFloat(p.prezzo||0),0),0);
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
    return (filter==="tutti"||es===filter)&&(!search||fullName(u).toLowerCase().includes(search.toLowerCase())||String(u.id).includes(search));
  });

  const activeOnDate=selectedDate?umbrellas.filter(u=>(u.prenotazioni||[]).some(p=>dateInRange(selectedDate,p.dal,p.al))).map(u=>u.id):[];

  const iconBtn=(active)=>({display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:10,border:active?"none":"1px solid rgba(255,255,255,0.3)",background:active?"#fff":"rgba(255,255,255,0.12)",color:active?"#0d3b6e":"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:active?"bold":"normal",transition:"all 0.18s",whiteSpace:"nowrap"});

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
      <div style={{padding:"8px 24px 10px",display:"flex",gap:6,alignItems:"center",flexWrap:"nowrap",overflowX:"auto"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cerca…"
          style={{...IS,width:130,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.25)",color:"#fff",padding:"6px 10px",fontSize:12,flexShrink:0}}/>
        <div style={{width:1,height:22,background:"rgba(255,255,255,0.2)",flexShrink:0}}/>
        <button className="tbtn" onClick={()=>setShowCal(true)}     style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>📅</span> Calendario</button>
        <button className="tbtn" onClick={()=>setShowDB(true)}      style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>👥</span> Clienti</button>
        <button className="tbtn" onClick={()=>setShowSummary(true)} style={{...iconBtn(false),gap:4,flexShrink:0,padding:"6px 10px",fontSize:11}}><span style={{fontSize:13}}>📊</span> Riepilogo</button>
        <button onClick={()=>setShowGrid(true)} style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,padding:"6px 10px",cursor:"pointer",flexShrink:0,color:"#fff"}}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1.2"/><rect x="10" y="0" width="6" height="6" rx="1.2"/><rect x="0" y="10" width="6" height="6" rx="1.2"/><rect x="10" y="10" width="6" height="6" rx="1.2"/></svg>
          <span style={{fontSize:10,fontWeight:"bold"}}>{rows}×{cols}</span>
        </button>
      </div>

      {/* SELETTORE DATA — sempre visibile sopra la griglia */}
      <div style={{margin:"0 24px 10px",background:"rgba(255,255,255,0.12)",borderRadius:14,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,border:"1px solid rgba(255,255,255,0.25)"}}>
        {/* Freccia indietro */}
        <button onClick={()=>{
          const d=new Date((selectedDate||todayStr())+"T00:00:00");
          d.setDate(d.getDate()-1);
          setSelectedDate(toDateStr(d.getFullYear(),d.getMonth(),d.getDate()));
        }} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:16,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>

        {/* Input data */}
        <input
          type="date"
          value={selectedDate||todayStr()}
          onChange={e=>setSelectedDate(e.target.value)}
          style={{background:"transparent",border:"none",color:"#fff",fontSize:15,fontWeight:"bold",fontFamily:"'Georgia',serif",outline:"none",cursor:"pointer",flex:1,textAlign:"center"}}
        />

        {/* Freccia avanti */}
        <button onClick={()=>{
          const d=new Date((selectedDate||todayStr())+"T00:00:00");
          d.setDate(d.getDate()+1);
          setSelectedDate(toDateStr(d.getFullYear(),d.getMonth(),d.getDate()));
        }} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:16,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>›</button>

        {/* Oggi */}
        <button onClick={()=>setSelectedDate(todayStr())}
          style={{background:(!selectedDate||selectedDate===todayStr())?"#fff":"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:(!selectedDate||selectedDate===todayStr())?"#0d3b6e":"#fff",cursor:"pointer",fontSize:11,fontWeight:"bold",padding:"0 10px",height:30,flexShrink:0,fontFamily:"inherit"}}>
          Oggi
        </button>

        {/* Label giorno */}
        <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",flexShrink:0,textTransform:"capitalize"}}>
          {new Date((selectedDate||todayStr())+"T00:00:00").toLocaleDateString("it-IT",{weekday:"long"})}
        </div>

        {/* Prenota */}
        <button onClick={()=>setShowCal(true)} style={{padding:"0 12px",height:30,borderRadius:8,border:"none",background:"rgba(255,255,255,0.9)",color:"#0d3b6e",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:"bold",flexShrink:0}}>+ Prenota</button>
      </div>

      {/* GRIGLIA */}
      <div style={{padding:"0 24px 28px"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:7,fontSize:10,color:"rgba(255,255,255,0.38)",letterSpacing:3,textTransform:"uppercase"}}>
          <span>🌊 Fronte Mare</span><div style={{flex:1,height:1,background:"rgba(255,255,255,0.12)",margin:"0 10px"}}/><span>⬆️ Prima Fila</span>
        </div>
        <div style={{background:"rgba(255,255,255,0.08)",borderRadius:18,padding:11,border:"1px solid rgba(255,255,255,0.16)",backdropFilter:"blur(8px)"}}>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:6}}>
            {Array.from({length:rows*cols},(_,i)=>{
              const id=i+1, u=umbrellas.find(x=>x.id===id);
              if(!u) return null;
              const es=statusOnDate(u,viewDate);
              const c=STATUS_COLORS[es];
              const vis=filtered.some(x=>x.id===id);
              const act=activeOnDate.includes(id);
              // nome da visualizzare: dalla prenotazione attiva nella viewDate
              const prenView = getPrenForDate(u, viewDate);
              const displayName = prenView
                ? [prenView.nome, prenView.cognome].filter(Boolean).join(" ")
                : "";
              return (
                <div key={id} className="ucell" onClick={()=>setSelected(id)}
                  style={{background:vis?c.bg:"rgba(255,255,255,0.03)",border:act?"3px solid #fff":`2px solid ${vis?c.border:"rgba(255,255,255,0.07)"}`,borderRadius:11,padding:"7px 6px",opacity:vis?1:0.28,minHeight:70,boxShadow:act?"0 0 0 3px rgba(255,255,255,0.35)":vis?`0 2px 10px ${c.border}2a`:"none",position:"relative"}}>
                  {act&&<div style={{position:"absolute",top:2,right:2,background:"#fff",borderRadius:3,padding:"1px 3px",fontSize:7,color:"#0d3b6e",fontWeight:"bold"}}>📅</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <span style={{fontSize:12}}>⛱️</span>
                    <span style={{background:c.badge,color:"#fff",fontSize:7,padding:"1px 4px",borderRadius:20,fontWeight:"bold",textTransform:"uppercase"}}>{es}</span>
                  </div>
                  <div style={{fontSize:11,fontWeight:"bold",color:c.textColor,marginTop:2}}>#{id}</div>
                  {displayName
                    ?<div style={{fontSize:es==="prenotato"?9:7,color:c.textColor,fontWeight:es==="prenotato"?"bold":"normal",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div>
                    :<div style={{fontSize:7,color:"#bbb",marginTop:1}}>—</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",marginTop:7,fontSize:10,color:"rgba(255,255,255,0.38)",letterSpacing:3,textTransform:"uppercase"}}>
          <span>⬇️ Ultima Fila</span><div style={{flex:1,height:1,background:"rgba(255,255,255,0.12)",margin:"0 10px"}}/><span>🏖️ Entrata</span>
        </div>
      </div>

      {selected!=null && umbrellas.find(x=>x.id===selected) && (
        <UmbrellaModal
          umbrella={umbrellas.find(x=>x.id===selected)}
          allUmbrellas={umbrellas}
          onSave={handleSave}
          onClose={()=>setSelected(null)}
        />
      )}
      {showGrid    && <GridSettingsModal rows={rows} cols={cols} onApply={handleApplyGrid} onClose={()=>setShowGrid(false)}/>}
      {showDB      && <DatabaseModal umbrellas={umbrellas} onClose={()=>setShowDB(false)}/>}
      {showCal     && <CalendarView umbrellas={umbrellas} selectedDate={selectedDate} onSelectDate={setSelectedDate} onSave={handleCalSave} onClose={()=>setShowCal(false)}/>}
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
