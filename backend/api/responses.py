from collections.abc import Mapping

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def ok(data, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"ok": True, "data": data})


def error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"ok": False, "error": {"code": code, "message": message}},
    )


def _code_for_http_error(status_code: int, detail) -> str:
    if isinstance(detail, Mapping) and "code" in detail:
        return str(detail["code"])
    code_map = {
        400: "BAD_REQUEST",
        401: "AUTH_INVALID_TOKEN",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
    }
    return code_map.get(status_code, "HTTP_ERROR")


def _message_for_http_error(status_code: int, detail) -> str:
    if isinstance(detail, Mapping) and "message" in detail:
        return str(detail["message"])
    if isinstance(detail, str):
        return detail
    if status_code == 422:
        return "请求参数无效"
    return "请求失败"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def handle_http_exception(_request, exc: HTTPException):
        return error(
            exc.status_code,
            _code_for_http_error(exc.status_code, exc.detail),
            _message_for_http_error(exc.status_code, exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_request, _exc: RequestValidationError):
        return error(422, "VALIDATION_ERROR", "请求参数无效")

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request, _exc: Exception):
        return error(500, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试")
