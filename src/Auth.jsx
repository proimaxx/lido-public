import { useState } from "react";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

export default function Auth({ app, onLogin }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOk, setResetOk] = useState(false);

  const auth = getAuth(app);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Salva profilo su Firestore
        const { getFirestore, doc, setDoc } = await import("firebase/firestore");
        const db = getFirestore();
        await setDoc(doc(db, "utenti", cred.user.uid), {
          nome: nome.toUpperCase(),
          cognome: cognome.toUpperCase(),
          telefono,
          email,
          createdAt: Date.now()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setError("Email già registrata");
      else if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") setError("Email o password errati");
      else if (e.code === "auth/weak-password") setError("Password troppo corta (min 6 caratteri)");
      else if (e.code === "auth/invalid-email") setError("Email non valida");
      else setError("Errore: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0d3b6e,#1a5c9a)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",padding:16}}>
      <div style={{background:"#fff",borderRadius:24,padding:"36px 28px",width:"100%",maxWidth:400,boxShadow:"0 40px 100px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:40}}>⛱️</div>
          <div style={{fontSize:22,fontWeight:"bold",color:"#1a2e4a",marginTop:8}}>Lido Vigna di Valle</div>
          <div style={{fontSize:13,color:"#888",marginTop:4}}>
            {mode === "login" ? "Accedi al tuo account" : "Crea il tuo account"}
          </div>
        </div>

        {mode === "register" && (
          <>
            <input value={nome} onChange={e=>setNome(e.target.value.toUpperCase())} placeholder="Nome" style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"2px solid #e8e8e8",fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
            <input value={cognome} onChange={e=>setCognome(e.target.value.toUpperCase())} placeholder="Cognome" style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"2px solid #e8e8e8",fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
            <input value={telefono} onChange={e=>setTelefono(e.target.value)} placeholder="Telefono" type="tel" style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"2px solid #e8e8e8",fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
          </>
        )}

        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"2px solid #e8e8e8",fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"2px solid #e8e8e8",fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:16}}/>

        {error && <div style={{color:"#dc3545",fontSize:13,marginBottom:12,textAlign:"center"}}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a5c9a,#0d3b6e)",color:"#fff",fontSize:16,fontWeight:"bold",cursor:"pointer",fontFamily:"inherit",opacity:loading?0.7:1}}>
          {loading ? "..." : mode === "login" ? "Accedi" : "Registrati"}
        </button>

        <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"#888"}}>
          {mode === "login" ? (
            <>Non hai un account? <span onClick={()=>setMode("register")} style={{color:"#0d6efd",cursor:"pointer",fontWeight:"bold"}}>Registrati</span></>
          ) : (
            <>Hai già un account? <span onClick={()=>setMode("login")} style={{color:"#0d6efd",cursor:"pointer",fontWeight:"bold"}}>Accedi</span></>
          )}
        </div>
        {mode === "login" && (
          <div style={{textAlign:"center",marginTop:8,fontSize:12}}>
            {resetOk
              ? <div style={{background:"#fff3cd",borderRadius:8,padding:"10px 12px",border:"1px solid #ffc107",textAlign:"left"}}>
                  <div style={{color:"#856404",fontWeight:"bold",fontSize:12,marginBottom:4}}>✅ Email inviata!</div>
                  <div style={{color:"#856404",fontSize:11}}>Se non la trovi in arrivo, controlla la cartella <strong>SPAM</strong> o <strong>Posta indesiderata</strong>.<br/>⚠️ <strong>Importante:</strong> prima di cliccare il link, sposta l'email dalla cartella spam nella posta in arrivo, altrimenti il link potrebbe non funzionare.</div>
                </div>
              : <span onClick={async()=>{
                  if(!email) { alert("Inserisci prima la tua email"); return; }
                  try { await sendPasswordResetEmail(auth, email); setResetOk(true); }
                  catch(e) { alert("Email non trovata"); }
                }} style={{color:"#888",cursor:"pointer",textDecoration:"underline"}}>
                  Password dimenticata?
                </span>
            }
          </div>
        )}
      </div>
    </div>
  );
}
