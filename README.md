# Group Travel Planner

A tool for planning trips together with friends and family.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) with TypeScript
- [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- ESLint and Prettier, checked in CI with GitHub Actions

## Getting started

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Scripts

| Command                | What it does                     |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server             |
| `npm run build`        | Production build                 |
| `npm run start`        | Serve the production build       |
| `npm run lint`         | Run ESLint                       |
| `npm run typecheck`    | Type-check with TypeScript       |
| `npm run format`       | Format all files with Prettier   |
| `npm run format:check` | Check formatting without writing |

## Adding UI components

```bash
npx shadcn@latest add <component>
```

Components are added to `src/components/ui`.

## Workflow

Work on a feature branch and open a pull request into `main`. CI runs formatting, lint, type-check and build on every PR.
