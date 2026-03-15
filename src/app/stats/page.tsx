'use client'

import { useEffect, useState } from 'react'

function getToken() {
  return localStorage.getItem('geneasphere_token') || ''
}

export default function StatsPage() {
  const [data, setData] = useState<any>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const t = getToken()
    if (!t) {
      window.location.href = '/login'
      return
    }
    fetch('/api/stats', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json())
      .then(j => {
        if (j.error) setMsg(j.error)
        else setData(j)
      })
      .catch(() => setMsg('NETWORK_ERROR'))
  }, [])

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <h1>Statistiques</h1>
      {msg ? <div style={{ color: 'crimson', marginTop: 8 }}>{msg}</div> : null}
      {data ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <div>Total membres: <b>{data.totalMembers}</b></div>
          <div>Hommes: <b>{data.men}</b> Femmes: <b>{data.women}</b> Autre: <b>{data.other}</b></div>
          <div>Espérance de vie moyenne: <b>{data.avgLifeExpectancyYears ? data.avgLifeExpectancyYears.toFixed(1) + ' ans' : 'n/a'}</b></div>
          <div>Générations: <b>{data.generations}</b></div>
          <div>Enfants moyens par génération: <b>{data.avgChildrenPerGeneration ? data.avgChildrenPerGeneration.toFixed(2) : 'n/a'}</b></div>
        </div>
      ) : null}
    </div>
  )
}
