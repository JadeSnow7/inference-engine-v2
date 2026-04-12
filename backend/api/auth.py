from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException
from jose import JWTError, jwt

from config import settings


def create_access_token(user_id: str, expires_hours: int = 24) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "exp": now + timedelta(hours=expires_hours), "iat": now}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def get_current_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id

