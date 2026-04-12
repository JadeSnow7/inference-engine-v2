# Inference Engine V2

独立演示版 AI 教学辅助平台推理引擎。

## 启动

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 环境变量

- `DASHSCOPE_API_KEY`
- `SECRET_KEY`
- `REDIS_URL`

