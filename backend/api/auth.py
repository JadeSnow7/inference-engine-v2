from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException
from jose import ExpiredSignatureError, JWTError, jwt

from config import settings


def create_access_token(user_id: str, expires_hours: int = 24) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "exp": now + timedelta(hours=expires_hours), "iat": now}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def get_current_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"code": "AUTH_HEADER_INVALID", "message": "认证头格式无效"})

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail={"code": "AUTH_TOKEN_EXPIRED", "message": "登录状态已过期，请重新登录"}) from exc
    except JWTError as exc:
        raise HTTPException(status_code=401, detail={"code": "AUTH_INVALID_TOKEN", "message": "登录凭证无效"}) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail={"code": "AUTH_INVALID_TOKEN_PAYLOAD", "message": "登录凭证缺少用户信息"})
    return user_id

