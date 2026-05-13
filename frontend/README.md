# ScholarScript Frontend

This is the only production frontend for the repository. The archived `academic-workbench-fe/` directory is not part of deployment or acceptance testing.

## Start

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies:

- `/api` to `http://localhost:8000`
- `/v1` to `http://localhost:8000`

## Verify

```bash
npm run test -- --run
npm run build
```

`npm run build` runs `tsc -b` before Vite build. Type-only imports must use `import type` because `verbatimModuleSyntax` is enabled.

## Architecture

```text
src/App.tsx                         routes and protected shell
src/pages/Dashboard.tsx             dashboard summary from /api/dashboard
src/pages/Courses.tsx               research spaces from /api/courses
src/pages/Library.tsx               evidence from /api/library
src/pages/Discovery.tsx             graph data from /api/graph
src/pages/WorkspacePage/            academic writing workspace
src/components/workspace/           top bar, sidebar, search, notifications, settings
src/features/ai/AIChatInput.tsx     /api/chat SSE and document AI actions
src/features/document/              editor, citation coverage, toolbar actions
src/features/version/               version list and diff review
src/store/workspace.ts              document, versions, suggestions, RAG artifacts
src/store/layout.ts                 workbench context and shell state
src/api/                            typed backend clients
```

## Connected Features

- Workspace document persistence and versions use `/api/documents`.
- Courses, dashboard, library, and discovery graph load from backend APIs.
- Global/workspace/conversation search use `/api/search`.
- Notifications and settings use `/api/notifications` and `/api/settings`.
- Document toolbar actions for rewrite, expand, logic check, and citation enhancement reuse `/api/chat` SSE and produce reviewable suggestions.
- Web search mode is intentionally disabled until a real backend provider exists.

## UI Conventions

- Use Zustand selectors, not whole-store destructuring.
- Keep API error, empty, and loading states visible.
- Use lucide icons for icon buttons where available.
- Do not add new production data fallbacks from `workspaceMock`; it remains only as initial local seed/test fixture until a bootstrap API replaces it.
