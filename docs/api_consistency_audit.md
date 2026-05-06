# API Consistency Audit (Backend vs Frontend Envelope)

## Scope
- Backend routes under `backend/api/*.py`
- Frontend API callers under `frontend/src/api/*.ts` and consuming pages/components

## Findings
1. **No unwrapped JSON route return values found** among declared FastAPI routers; JSON routes consistently return `ok(...)`.
2. **Potential auth error-code mismatch:** backend auth dependency raises raw-string `HTTPException(detail="...")`, which is still enveloped, but maps to `AUTH_INVALID_TOKEN` for all 401 statuses.
3. **SSE error handling mismatch:** frontend `connectSSE` does not parse envelope JSON when `/api/chat` returns non-2xx; it only emits `连接失败 (status)` and drops backend `error.message`.
4. **Data-shape risk:** `/api/profile/me` may return `{}` while frontend `UserProfile` type expects fully populated required fields.

## Recommendations
- Add explicit custom code/message dict in auth dependency (`AUTH_INVALID_TOKEN`/`AUTH_INVALID_HEADER`) for 401s.
- In `connectSSE`, parse `res.json()` on non-OK responses and surface `error.message` if present.
- Change `fetchProfile` return type to `Partial<UserProfile>` or ensure backend always returns full defaults.
