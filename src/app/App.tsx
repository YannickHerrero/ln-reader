import { Route, Routes } from 'react-router-dom'

function LibraryPage() {
  return (
    <main className="shell">
      <header className="masthead">
        <p className="eyebrow">Bibliothèque personnelle</p>
        <h1>LN Reader</h1>
        <p className="lede">Vos light novels, disponibles chapitre après chapitre.</p>
      </header>
      <section className="empty-state">
        <span className="empty-state__mark">文</span>
        <h2>Votre bibliothèque est vide</h2>
        <p>Recherchez un titre pour commencer votre collection.</p>
        <button type="button">Rechercher un titre</button>
      </section>
    </main>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="*" element={<LibraryPage />} />
    </Routes>
  )
}
