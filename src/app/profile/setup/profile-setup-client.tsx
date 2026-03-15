"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { requireTokenOrRedirect } from "@/app/_lib/authClient"

export default function ProfileSetupClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get("next") || "/tree"

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [sex, setSex] = useState<"M" | "F" | "X">("X")
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC")
  const [msg, setMsg] = useState("")

  useEffect(() => {
    try { requireTokenOrRedirect() } catch {}
  }, [])

  async function submit() {
    setMsg("")
    const token = requireTokenOrRedirect()

    const res = await fetch("/api/profile/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      body: JSON.stringify({ firstName, lastName, sex, visibility }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(String(data?.error || "SETUP_FAILED"))
      return
    }

    router.push(next)
  }

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Créer ton profil (membre racine)</h1>
      <p style={{ opacity: 0.85 }}>
        Pour afficher l’arbre, chaque compte doit avoir un membre “profil”.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          Prénom
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <label>
          Nom
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <label>
          Sexe
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as any)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          >
            <option value="X">X</option>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </label>

        <label>
          Visibilité
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as any)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          >
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
        </label>

        <button
          onClick={submit}
          style={{ padding: 10, cursor: "pointer", fontWeight: 600 }}
        >
          Créer mon profil
        </button>

        {msg ? <div style={{ color: "crimson" }}>Erreur: {msg}</div> : null}
      </div>
    </div>
  )
}
