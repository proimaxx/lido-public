import { useState } from "react";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { dbPublico } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

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
    if (mode === "register") {
      const telefonoPulito = telefono.replace(/\s/g,"");
      if (!/^3\d{8,9}$/.test(telefonoPulito)) {
        setError("Inserisci un numero di cellulare italiano valido (es. 3331234567)");
        return;
      }
      if (!nome.trim() || !cognome.trim()) {
        setError("Inserisci nome e cognome");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Salva profilo su Firestore (stessa istanza usata dal resto dell'app)
        await setDoc(doc(dbPublico, "utenti", cred.user.uid), {
          nome: nome.toUpperCase(),
          cognome: cognome.toUpperCase(),
          telefono: telefono.replace(/\s/g,""),
          email,
          createdAt: Date.now()
        });
        await sendEmailVerification(cred.user);
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

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      // Se è il primo accesso, crea il profilo base (nome/cognome da Google, telefono da completare)
      const { getDoc } = await import("firebase/firestore");
      const existing = await getDoc(doc(dbPublico, "utenti", cred.user.uid));
      if (!existing.exists()) {
        const parts = (cred.user.displayName || "").split(" ");
        await setDoc(doc(dbPublico, "utenti", cred.user.uid), {
          nome: (parts[0] || "").toUpperCase(),
          cognome: (parts.slice(1).join(" ") || "").toUpperCase(),
          telefono: "",
          email: cred.user.email,
          createdAt: Date.now()
        });
      }
      onLogin();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") setError("Errore Google: " + e.message);
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

        <div style={{display:"flex",alignItems:"center",gap:10,margin:"16px 0"}}>
          <div style={{flex:1,height:1,background:"#e8e8e8"}}/>
          <span style={{fontSize:12,color:"#aaa"}}>oppure</span>
          <div style={{flex:1,height:1,background:"#e8e8e8"}}/>
        </div>

        <button onClick={handleGoogle} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:12,border:"2px solid #e8e8e8",background:"#fff",color:"#444",fontSize:14,fontWeight:"bold",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:loading?0.7:1}}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.95 10.7c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.97H.96A8.996 8.996 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
          Continua con Google
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
