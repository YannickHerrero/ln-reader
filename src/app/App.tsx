import { Navigate, Route, Routes } from 'react-router-dom'
import { LibraryPage } from '../pages/LibraryPage'
import { SeriesPage } from '../pages/SeriesPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="/series/:seriesId" element={<SeriesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
