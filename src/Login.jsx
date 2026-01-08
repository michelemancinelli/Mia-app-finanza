import { useState } from "react"
import { supabase } from "./lib/supabaseClient"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [msg, setMsg] = useState("")

  const submit = async (e) => {
    e.preventDefault()
    setMsg("")

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setMsg(error.message)
      else setMsg("Registrazione ok: controlla la mail (anche spam) e conferma.")
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message)
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "60px auto", padding: 16 }}>
      <h2>{isSignUp ? "Crea account" : "Accedi"}</h2>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">{isSignUp ? "Registrati" : "Login"}</button>
      </form>

      <button onClick={() => setIsSignUp(!isSignUp)} style={{ marginTop: 10 }}>
        {isSignUp ? "Hai già un account? Login" : "Nuovo? Registrati"}
      </button>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  )
}
