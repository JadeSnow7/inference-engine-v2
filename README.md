# Inference Engine V2

ScholarScript 生产联调工程。生产前端入口只有 `frontend/`；`academic-workbench-fe/` 是早期设计/demo 工程，不参与部署，也不应作为线上 UI 使用。

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
- Frontend: `http://localhost:5173`，通过 Vite 代理 `/api` 和 `/v1`

`backend/.env.example` 用于本地开发；仓库根目录 `.env.example` 可用于 Docker Compose 场景。

## 前端入口

- `frontend/`: 唯一生产 React/Vite 前端，Docker Compose 的 `frontend` 服务也从这里构建。
- `academic-workbench-fe/`: demo-only 设计样机。它没有完整生产 API 集成，不用于部署、不用于验收生产问题。

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
