let mutationHandler: (() => void) | null = null

export function setSyncMutationHandler(handler: (() => void) | null): void {
  mutationHandler = handler
}

export function scheduleSyncAfterMutation(): void {
  mutationHandler?.()
}
