export default function HomePage() {
  return (
    <main style={{ maxWidth: 820, margin: '50px auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 34, marginBottom: 10 }}>GeneaSphere</h1>
      <p style={{ marginTop: 0 }}>
        Application de gestion d’arbre généalogique intelligent (Next.js + API REST + MongoDB + JWT + RBAC).
      </p>

      <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        <a href="/login" style={linkStyle}>Connexion / Token</a>
        <a href="/members" style={linkStyle}>Gestion des membres</a>
        <a href="/unions" style={linkStyle}>Gestion des unions</a>
        <a href="/tree" style={linkStyle}>Arbre généalogique (SVG)</a>
        <a href="/stats" style={linkStyle}>Statistiques</a>
        <a href="/admin" style={linkStyle}>Administration (validation utilisateurs)</a>
      </div>
    </main>
  )
}

const linkStyle: React.CSSProperties = {
  padding: 14,
  border: '1px solid #ddd',
  textDecoration: 'none',
  color: 'black',
  borderRadius: 6
}
