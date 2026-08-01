export const LYRA_READER_MESSAGE_HANDLER = 'lyraReader'
export const LYRA_SET_PAGE_EVENT = 'lyra:set-page'

export interface NativeReaderState {
  active: boolean
  index: number
  count: number
}

interface NativeMessageHandler {
  postMessage(message: NativeReaderState): void
}

type NativeWindow = Window & {
  webkit?: {
    messageHandlers?: Record<string, NativeMessageHandler | undefined>
  }
}

export function postNativeReaderState(state: NativeReaderState): void {
  const handler = (window as NativeWindow).webkit?.messageHandlers?.[LYRA_READER_MESSAGE_HANDLER]
  handler?.postMessage(state)
}

export function subscribeToNativePageSelection(onSelect: (index: number) => void): () => void {
  const handlePageSelection: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    const index = event.detail?.index
    if (!Number.isInteger(index) || index < 0) return
    onSelect(index)
  }

  window.addEventListener(LYRA_SET_PAGE_EVENT, handlePageSelection)
  return () => window.removeEventListener(LYRA_SET_PAGE_EVENT, handlePageSelection)
}
