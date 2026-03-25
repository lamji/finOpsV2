# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 16 + React 19 + TypeScript** application with **shadcn/ui** components, **TailwindCSS**, and **dark mode support**. The project uses the App Router pattern and is configured for type safety with strict TypeScript compilation.

## Common Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack (http://localhost:3000)

# Building & Production
npm run build        # Build for production
npm run start        # Run production server

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run typecheck    # Run TypeScript type checking without emitting

# Development Workflow
npm run dev          # Watch mode for development
npm run typecheck    # Verify types in isolation
npm run lint         # Check linting issues before commit
npm run format       # Auto-format code before committing
```

## Architecture

### Directory Structure

```
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with ThemeProvider
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles (TailwindCSS)
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   │   └── button.tsx      # Example component with CVA variants
│   └── theme-provider.tsx  # Dark mode provider with keyboard shortcut
├── lib/                    # Utilities and helpers
│   └── utils.ts            # cn() classname utility (clsx + tailwind-merge)
├── hooks/                  # Custom React hooks (empty, add here)
├── public/                 # Static assets
└── package.json
```

### High-Level Architecture

**Root Layout Flow:**
- `app/layout.tsx` (Root)
  - Wraps app with `ThemeProvider` from `next-themes`
  - Sets up Geist fonts as CSS variables
  - Uses `cn()` utility for class merging
  - Enables dark mode with `suppressHydrationWarning`

**Theme System:**
- `components/theme-provider.tsx` provides dark/light mode
- Dark mode toggle via **keyboard shortcut: Press 'd'**
- Uses `next-themes` for SSR-safe theme handling
- Detects typing targets to avoid theme toggle during text input

**Component Pattern:**
- Components use **class-variance-authority (CVA)** for style variants
- All styling through TailwindCSS (never raw HTML in shadcn/ui components)
- Radix UI as base component library
- `cn()` utility merges TailwindCSS classes intelligently

### Type Aliases & Path Resolution

- `@/*` maps to repository root (configured in `tsconfig.json`)
- Use `import { Button } from "@/components/ui/button"` format
- All paths are absolute from root for clarity

## Key Conventions

### Component Structure

shadcn/ui components follow this pattern:
1. Use `cva()` from class-variance-authority for variants
2. Define base styles and variant styles separately
3. Use `cn()` to merge variant classes with custom classes
4. Export both component and variant styles (e.g., `buttonVariants`)

Example pattern from `components/ui/button.tsx`:
```tsx
const buttonVariants = cva(/* base styles */, {
  variants: { /* variant definitions */ },
  defaultVariants: { /* defaults */ }
})

function Button({ className, variant, size, asChild, ...props }) {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
```

### Styling Approach

- **All styling is via TailwindCSS** (utility-first)
- Use `cn()` function (from `lib/utils.ts`) to merge classes:
  ```tsx
  className={cn("px-2 py-1", condition && "bg-red-500", customClass)}
  ```
- Prettier auto-formats TailwindCSS classes (via `prettier-plugin-tailwindcss`)
- Class order is automatically sorted by Prettier

### Dark Mode

- Triggered by pressing **'d'** key (won't trigger if focused on input/textarea/select)
- Theme attribute is `class` (dark mode adds `dark` class to html)
- Default theme is `light` with system detection enabled
- Use `useTheme()` hook to access `theme`, `setTheme`, `resolvedTheme`

## Development Workflow

### Adding New UI Components

```bash
# Add a component from shadcn/ui
npx shadcn@latest add [component-name]

# Examples:
npx shadcn@latest add input
npx shadcn@latest add dialog
npx shadcn@latest add select
```

This places components in `components/ui/` and they're ready to import.

### Adding Custom Hooks

Place custom hooks in `hooks/` directory. Example structure:
```tsx
// hooks/useFoo.ts
import { useState } from "react"

export function useFoo() {
  const [state, setState] = useState()
  return { state, setState }
}
```

Import with: `import { useFoo } from "@/hooks/useFoo"`

### Adding Utility Functions

Add utility functions to `lib/utils.ts` or create new files in `lib/`. They should be:
- Pure functions where possible
- Well-typed with TypeScript
- Re-exported from `lib/index.ts` if creating new files

### Type Safety

- **Strict mode enabled** in `tsconfig.json`
- Run `npm run typecheck` frequently during development
- Components should accept `React.ComponentProps<"element">` for native HTML attributes
- Use `Readonly<{ children: React.ReactNode }>` for immutable props

## Code Quality Tools

### ESLint
- Uses Next.js core web vitals configuration
- Extends with TypeScript support
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

### Prettier
- Line width: 80 characters
- Tab width: 2 spaces
- No semicolons
- Double quotes (not single)
- Trailing commas: ES5 style
- Auto-sorts TailwindCSS classes

### TypeScript
- Strict: true (no implicit any)
- Module: esnext
- Target: ES2017
- Bundler resolution with path aliases

## Dependencies Overview

| Package | Purpose |
|---------|---------|
| `next` | React framework with App Router |
| `react`, `react-dom` | Core React library |
| `typescript` | Type safety |
| `tailwindcss` | Utility-first CSS framework |
| `shadcn` | CLI for adding components |
| `class-variance-authority` | CSS variant management |
| `radix-ui` | Unstyled, accessible components |
| `next-themes` | Dark/light mode provider |
| `lucide-react` | Icon library |
| `clsx`, `tailwind-merge` | Class merging utilities |

## Performance Notes

- Turbopack enabled in dev mode (`npm run dev --turbopack`)
- Uses `suppressHydrationWarning` on `<html>` due to theme hydration
- Images should be optimized with Next.js `<Image>` component
- Use client components (`"use client"`) only when necessary (hooks, events, state)

## Browser Support

- Modern browsers (ES2017+)
- Dark mode uses CSS class-based approach (works in all browsers)
- Responsive design via TailwindCSS breakpoints

## Next Steps for Development

1. Create page components in `app/` directory
2. Add UI components with `npx shadcn@latest add [name]`
3. Build custom components in `components/` using CVA + TailwindCSS
4. Add business logic in `lib/` utilities or `hooks/`
5. Run `npm run typecheck` and `npm run lint` before committing
6. Use `npm run format` to auto-format code
