# EVA Three Magi System

一个可外部访问的 EVA 三贤人系统，支持在打开页面时通过交互向导为三位贤人选择不同 AI，并提供 EVA 风格前端控制台。

## 功能

- 打开即配置：首次进入页面自动弹出配置向导
- 三贤人无重复选择：从 `GPT / Gemini / Qwen / DeepSeek / Doubao / 自定义` 中选择三个不同 AI
- 统一 Provider 抽象：通过 `base_url + api_key + model` 配置不同供应商
- 对外开放 REST API：`/api/catalog`、`/api/deliberate`
- EVA 风格前端：状态面板、会商输入区、综合决议区
- 适合外网部署：默认监听 `0.0.0.0:8000`

## 快速启动

1. 可选：配置环境变量，参考 `.env.example`
环境变量只用于给配置向导提供推荐默认值，不再强制要求写死三贤人。
2. 安装依赖：

```bash
pip install -r requirements.txt
```

3. 启动服务：

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

4. 打开浏览器访问：

```text
http://localhost:8000
```

## API 设计

### `GET /api/catalog`

返回可选模型清单和推荐默认配置。

### `POST /api/deliberate`

请求体示例：

```json
{
  "prompt": "请帮我设计一个 AI 产品的发布计划。",
  "system_prompt": "请用中文回答，给出结论、风险、建议。",
  "temperature": 0.7,
  "max_tokens": 1200,
  "providers": [
    {
      "slot": "melchior",
      "provider_key": "gpt",
      "label": "GPT",
      "api_key": "sk-...",
      "model": "gpt-4o-mini",
      "base_url": "https://api.openai.com/v1"
    },
    {
      "slot": "balthasar",
      "provider_key": "deepseek",
      "label": "DeepSeek",
      "api_key": "sk-...",
      "model": "deepseek-v4-flash",
      "base_url": "https://api.deepseek.com"
    },
    {
      "slot": "casper",
      "provider_key": "qwen",
      "label": "Qwen",
      "api_key": "sk-...",
      "model": "qwen-plus",
      "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
  ]
}
```

返回值包括：

- `council`：三位贤人的独立回复
- `consensus`：系统生成的综合决议

## 外网部署建议

- 使用云服务器时放行 `8000` 端口，或通过 Nginx / Caddy 反代
- 建议开启 HTTPS，并把 API Key 仅保留在服务端环境变量
- 如需长期稳定对外，可部署到 Docker、云主机或 PaaS

## 官方接口参考

- DeepSeek OpenAI-compatible docs: <https://api-docs.deepseek.com/>
- 阿里云百炼 OpenAI 兼容接口: <https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope>
- 火山方舟兼容 OpenAI SDK: <https://www.volcengine.com/docs/82379/1330626?lang=zh>
