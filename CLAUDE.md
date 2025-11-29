# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev      # Start development server at localhost:3000
bun build    # Production build
bun lint     # Run ESLint
```

## Tech Stack

- Next.js 16 with App Router (React 19)
- TypeScript with strict mode
- Tailwind CSS 4 with PostCSS
- shadcn/ui (new-york style) with Lucide icons

## Architecture

- `app/` - Next.js App Router pages and layouts
- `lib/utils.ts` - Utility functions (includes `cn()` for class merging)
- `components/ui/` - shadcn/ui components (add with `bunx shadcn@latest add <component>`)

## Path Aliases

`@/*` maps to project root (e.g., `@/lib/utils`, `@/components/ui/button`)

## Commit Rules

- Never mention Claude in commit messages or descriptions
- Keep commit messages short and concise
- Use bullet points in commit descriptions
- Split changes into separate commits when necessary (one commit per feature or fix)
