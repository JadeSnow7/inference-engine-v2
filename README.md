# Inference Engine V2

独立演示版 AI 教学辅助平台推理引擎。

## 启动

### 本地联调

```bash
redis-server

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000

cd ../frontend
npm install
npm run dev
```

默认链路：
- Redis: `redis://localhost:6379/0`
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`，通过 Vite 代理 `/api`

`backend/.env.example` 用于本地开发；仓库根目录 `.env.example` 可用于 Docker Compose 场景。

## 环境变量

- `DASHSCOPE_API_KEY`
- `SECRET_KEY`
- `REDIS_URL`

## 前端测试与构建

```bash
cd frontend
npm run test -- --run
npm run build
```
