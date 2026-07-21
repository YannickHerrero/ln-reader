import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})
