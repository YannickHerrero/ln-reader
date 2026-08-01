import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LYRA_SET_PAGE_EVENT,
  postNativeReaderState,
  subscribeToNativePageSelection,
} from '../src/reader/native-bridge'

interface TestWindow extends Window {
  webkit?: {
    messageHandlers: {
      lyraReader: { postMessage: ReturnType<typeof vi.fn> }
    }
  }
}

afterEach(() => {
  delete (window as TestWindow).webkit
})

describe('Lyra native reader bridge', () => {
  it('posts focused reader state when the native handler is available', () => {
    const postMessage = vi.fn()
    ;(window as TestWindow).webkit = {
      messageHandlers: { lyraReader: { postMessage } },
    }

    postNativeReaderState({ active: true, index: 4, count: 12 })

    expect(postMessage).toHaveBeenCalledWith({ active: true, index: 4, count: 12 })
  })

  it('accepts valid native page selections and ignores malformed ones', () => {
    const onSelect = vi.fn()
    const unsubscribe = subscribeToNativePageSelection(onSelect)

    window.dispatchEvent(new CustomEvent(LYRA_SET_PAGE_EVENT, { detail: { index: 3 } }))
    window.dispatchEvent(new CustomEvent(LYRA_SET_PAGE_EVENT, { detail: { index: -1 } }))
    window.dispatchEvent(new CustomEvent(LYRA_SET_PAGE_EVENT, { detail: { index: 1.5 } }))
    window.dispatchEvent(new CustomEvent(LYRA_SET_PAGE_EVENT, { detail: {} }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith(3)

    unsubscribe()
    window.dispatchEvent(new CustomEvent(LYRA_SET_PAGE_EVENT, { detail: { index: 5 } }))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})
