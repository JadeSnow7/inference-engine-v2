import re

from fastapi import APIRouter, HTTPException, Request
from passlib.context import CryptContext
from pydantic import BaseModel

from api.auth import create_access_token
from store.redis_store import UserStore

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALLOWED_DOMAINS = re.compile(r'^[a-zA-Z0-9._%+\-]+@(stu\.)?hust\.edu\.cn$')


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/auth/register")
async def register(req: RegisterRequest, request: Request):
    if not ALLOWED_DOMAINS.match(req.email):
        raise HTTPException(status_code=400, detail="仅限 HUST 校园邮箱注册（@hust.edu.cn 或 @stu.hust.edu.cn）")
    store: UserStore = request.app.state.user_store
    if await store.exists(req.email):
        raise HTTPException(status_code=409, detail="邮箱已注册")
    await store.create(req.email, pwd_context.hash(req.password))
    return {"ok": True}


@router.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    store: UserStore = request.app.state.user_store
    hash_ = await store.get_hash(req.email)
    if not hash_ or not pwd_context.verify(req.password, hash_):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    return {"token": create_access_token(req.email)}
