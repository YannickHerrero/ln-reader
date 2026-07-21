import { useTheme } from '../theme/theme-context'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'clair' : 'sombre'

  return (
    <button
      className={`theme-toggle ${className}`.trim()}
      type="button"
      onClick={toggleTheme}
      aria-label={`Activer le thème ${nextTheme}`}
      title={`Activer le thème ${nextTheme}`}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.2 15.2A8.4 8.4 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" />
        </svg>
      )}
    </button>
  )
}
