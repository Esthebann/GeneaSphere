'use client'

import { useEffect, useState } from 'react'
import { requireTokenOrRedirect } from '@/app/_lib/authClient'

type Member = {
  id: string
  firstName: string
  lastName: string
  sex: 'M' | 'F' | 'X'
  visibility: 'PUBLIC' | 'PRIVATE'
}

type ChildLinkType = 'BIOLOGICAL' | 'ADOPTED' | 'FOSTER'
type UnionStatus = 'MARRIAGE' | 'PACS' | 'UNION' | 'DIVORCED' | 'SEPARATED'

export default function UnionsPage() {
  const [msg, setMsg] = useState('')

  const [q, setQ] = useState('')
  const [results, setResults] = useState<Member[]>([])

  const [p1, setP1] = useState<Member | null>(null)
  const [p2, setP2] = useState<Member | null>(null)

  const [child, setChild] = useState<Member | null>(null)
  const [childType, setChildType] = useState<ChildLinkType>('BIOLOGICAL')

  const [status, setStatus] = useState<UnionStatus>('UNION')

  function token() {
    return requireTokenOrRedirect()
  }

  async function search() {
    setMsg('Recherche...')
    const t = token()
    if (!t) return

    const res = await fetch('/api/members/search?q=' + encodeURIComponent(q), {
      headers: { Authorization: 'Bearer ' + t }
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (data?.error || 'SEARCH_FAILED'))
      setResults([])
      return
    }
    setResults(data.results || [])
    setMsg('OK')
  }

  async function upsertUnion() {
    if (!p1 && !p2) {
      setMsg('Choisis au moins 1 partenaire.')
      return
    }

    const partnerIds = [p1?.id, p2?.id].filter(Boolean)

    const children = child ? [{ childMemberId: child.id, linkType: childType }] : []

    setMsg('Création union...')
    const t = token()
    if (!t) return

    const res = await fetch('/api/unions/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({
        status,
        partnerIds,
        children
      })
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (data?.error || 'UPSERT_FAILED'))
      return
    }
    setMsg('OK union: ' + data.id)
  }

  function pickAsPartner1(m: Member) {
    setP1(m)
  }

  function pickAsPartner2(m: Member) {
    setP2(m)
  }

  function pickAsChild(m: Member) {
    setChild(m)
  }

  function clearAll() {
    setP1(null)
    setP2(null)
    setChild(null)
    setChildType('BIOLOGICAL')
    setStatus('UNION')
    setMsg('')
  }

  useEffect(() => {
    search()
  }, [])

  return (
    <main style={{ maxWidth: 1100, margin: '30px auto', fontFamily: 'system-ui', padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Gestion des unions</h1>
      <p>
        Liens: <a href="/">/</a> | <a href="/members">/members</a> | <a href="/tree">/tree</a>
      </p>

      <div style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}>{msg}</div>

      <section style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Recherche de membres</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom ou prénom" style={{ padding: 10, flex: 1 }} />
          <button onClick={search} style={{ padding: 10, cursor: 'pointer' }}>Chercher</button>
          <button onClick={clearAll} style={{ padding: 10, cursor: 'pointer' }}>Reset</button>
        </div>

        <div style={{ marginTop: 10, maxHeight: 260, overflow: 'auto', border: '1px solid #eee' }}>
          {results.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderBottom: '1px solid #eee' }}>
              <div style={{ flex: 1 }}>
                <b>{m.firstName} {m.lastName}</b> — {m.sex} — {m.visibility}
                <div style={{ fontSize: 12, opacity: 0.8 }}>{m.id}</div>
              </div>
              <button onClick={() => pickAsPartner1(m)} style={{ padding: 8, cursor: 'pointer' }}>Partenaire 1</button>
              <button onClick={() => pickAsPartner2(m)} style={{ padding: 8, cursor: 'pointer' }}>Partenaire 2</button>
              <button onClick={() => pickAsChild(m)} style={{ padding: 8, cursor: 'pointer' }}>Enfant</button>
            </div>
          ))}
          {results.length === 0 && <div style={{ padding: 10 }}>Aucun résultat.</div>}
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Créer une union</h2>

        <div style={{ display: 'grid', gap: 10, maxWidth: 700 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            Statut
            <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ padding: 10 }}>
              <option value="UNION">UNION</option>
              <option value="MARRIAGE">MARRIAGE</option>
              <option value="PACS">PACS</option>
              <option value="SEPARATED">SEPARATED</option>
              <option value="DIVORCED">DIVORCED</option>
            </select>
          </label>

          <div style={{ display: 'grid', gap: 6 }}>
            <div><b>Partenaire 1</b> {p1 ? `${p1.firstName} ${p1.lastName}` : '(non sélectionné)'}</div>
            <div><b>Partenaire 2</b> {p2 ? `${p2.firstName} ${p2.lastName}` : '(optionnel)'}</div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div><b>Enfant</b> {child ? `${child.firstName} ${child.lastName}` : '(optionnel)'}</div>
            <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
              Type de lien
              <select value={childType} onChange={e => setChildType(e.target.value as any)} style={{ padding: 10 }}>
                <option value="BIOLOGICAL">BIOLOGICAL</option>
                <option value="ADOPTED">ADOPTED</option>
                <option value="FOSTER">FOSTER</option>
              </select>
            </label>
          </div>

          <button onClick={upsertUnion} style={{ padding: 10, cursor: 'pointer' }}>Créer / Mettre à jour l’union</button>
        </div>

        <p style={{ marginTop: 12, marginBottom: 0 }}>
          Démo: sélectionne 2 partenaires + 1 enfant, clique “Créer”, puis va sur /tree et mets depth à 3.
        </p>
      </section>
    </main>
  )
}
