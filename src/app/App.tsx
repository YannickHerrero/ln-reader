import { Navigate, Route, Routes } from 'react-router-dom'
import { LibraryPage } from '../pages/LibraryPage'
import { ReaderPage } from '../pages/ReaderPage'
import { SeriesPage } from '../pages/SeriesPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LibraryPage />} />
      <Route path="/series/:seriesId" element={<SeriesPage />} />
      <Route path="/read/:seriesId/:chapterId" element={<ReaderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
