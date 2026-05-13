# Bailian First Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bailian App the default provider for AI-facing APIs while keeping business data APIs local and retaining safe fallback behavior.

**Architecture:** Add an explicit `AI_PROVIDER_PREFERENCE=bailian_first` setting and route `/api/chat` through a Bailian-first SSE loop when configured. Extend `/v1/writing/analyze` to use Bailian for generated analysis metadata while preserving the existing norm-retriever structured nodes, validation, and fallback output. Expose active provider status through `/api/config/status` and show it in the global top bar.

**Tech Stack:** FastAPI, Python unittest, DashScope Bailian App adapter, React, TypeScript, Vitest, Tailwind CSS.

---

### Task 1: Backend Provider Preference And Chat Routing

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/api/health.py`
- Modify: `backend/api/chat.py`
- Create: `backend/core/bailian_first.py`
- Test: `backend/tests/test_chat_api.py`
- Test: `backend/tests/test_config.py`

- [ ] **Step 1: Write failing tests**

Add tests that assert `AI_PROVIDER_PREFERENCE` defaults to `bailian_first`, config status exposes `active_provider`, and `/api/chat` uses the Bailian-first loop for normal chat when configured.

- [ ] **Step 2: Verify red**

Run:

```bash
PYTHONPATH=backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest backend.tests.test_config backend.tests.test_chat_api
```

Expected: fail because `AI_PROVIDER_PREFERENCE`, `active_provider`, and the Bailian-first route do not exist.

- [ ] **Step 3: Implement minimal backend route**

Add the config field, a `bailian_first_loop` wrapper that tries Bailian and falls back to `main_loop`, and route normal `/api/chat` requests through it.

- [ ] **Step 4: Verify green**

Run the same unittest command and confirm it passes.

### Task 2: Bailian-Backed Writing Analysis

**Files:**
- Modify: `backend/api/writing.py`
- Test: `backend/tests/test_writing_api.py`

- [ ] **Step 1: Write failing tests**

Add tests that patch `call_bailian_app_once` and verify `/v1/writing/analyze` includes a generated Bailian summary when configured, while preserving structured norm nodes and fallback behavior.

- [ ] **Step 2: Verify red**

Run:

```bash
PYTHONPATH=backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest backend.tests.test_writing_api
```

Expected: fail because writing analysis does not call Bailian.

- [ ] **Step 3: Implement minimal writing analysis integration**

Call Bailian once with norm context and user text, attach the returned text as `analysis`, and continue returning existing nodes, expanded context, validation, references, and context.

- [ ] **Step 4: Verify green**

Run the same unittest command and confirm it passes.

### Task 3: Frontend Provider Status Indicator

**Files:**
- Create: `frontend/src/api/config.ts`
- Create: `frontend/src/components/workspace/ProviderStatusIndicator.tsx`
- Modify: `frontend/src/components/workspace/GlobalTopBar.tsx`
- Test: `frontend/src/components/workspace/__tests__/ProviderStatusIndicator.test.tsx`

- [ ] **Step 1: Write failing tests**

Add a Vitest test that mocks `/api/config/status`, renders the top bar or indicator, and expects `百炼优先` plus the current model/RAG state.

- [ ] **Step 2: Verify red**

Run:

```bash
cd frontend
npx -y node@20 ./node_modules/vitest/vitest.mjs --run src/components/workspace/__tests__/ProviderStatusIndicator.test.tsx
```

Expected: fail because the config API helper and indicator do not exist.

- [ ] **Step 3: Implement minimal indicator**

Fetch config status on mount, render a compact button-like status chip in the top bar, and show a simple detail popover on click.

- [ ] **Step 4: Verify green**

Run the same Vitest command and confirm it passes.

### Task 4: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend targeted tests**

```bash
PYTHONPATH=backend /root/.venvs/inference-engine-backend/bin/python -B -m unittest \
  backend.tests.test_config \
  backend.tests.test_chat_api \
  backend.tests.test_writing_api \
  backend.tests.test_bailian_app \
  backend.tests.test_norms_loop
```

- [ ] **Step 2: Run frontend targeted and build checks**

```bash
cd frontend
npx -y node@20 ./node_modules/vitest/vitest.mjs --run src/components/workspace/__tests__/ProviderStatusIndicator.test.tsx
npx -y node@20 ./node_modules/typescript/bin/tsc -b
npx -y node@20 ./node_modules/vite/bin/vite.js build
```

- [ ] **Step 3: Run whitespace/status checks**

```bash
git diff --check
git status --short
```

