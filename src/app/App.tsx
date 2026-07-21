import { Navigate, Route, Routes } from 'react-router-dom'
import { LibraryPage } from '../pages/LibraryPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
