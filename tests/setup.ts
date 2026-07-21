import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true })

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})
