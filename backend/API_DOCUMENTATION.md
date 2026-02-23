# 工作日记 API 接口文档

## 概述

工作日记应用提供 RESTful API，允许外部应用程序（如 AI Agent、自动化工具等）访问和管理工作日记数据。

## 认证方式

所有 API 请求需要使用 API Key 进行认证。您可以在应用的用户设置页面创建 API Key。

### 请求头认证

在请求头中包含您的 API Key：

```
X-API-Key: wdk_your_api_key_here
```

### 示例请求

```bash
curl -X GET "https://your-server.com/api/v1/diaries" \
  -H "X-API-Key: wdk_your_api_key_here"
```

## 基础 URL

```
https://your-server.com/api/v1
```

## 响应格式

所有响应均为 JSON 格式：

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "success": false,
  "error": "错误类型",
  "message": "详细错误信息"
}
```

---

## 接口列表

### 日记接口

#### 获取日记列表

```
GET /diaries
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| startDate | string | 开始日期 (ISO 8601) |
| endDate | string | 结束日期 (ISO 8601) |
| search | string | 搜索内容、地点、标签 |
| tags | string | 标签（逗号分隔） |
| priority | string | 优先级：高/中/低 |
| page | number | 页码（默认：1） |
| limit | number | 每页数量（默认：20，最大：100） |
| sort | string | 排序：asc 或 desc（默认：desc） |

#### 获取单个日记

```
GET /diaries/:id
```

#### 创建日记

```
POST /diaries
```

**所需权限：** `diary:write` 或 `all`

**请求体：**

```json
{
  "content": "今天完成了API开发工作",
  "location": "办公室",
  "startTime": "2024-01-01T09:00:00Z",
  "endTime": "2024-01-01T18:00:00Z",
  "tags": ["开发", "API"],
  "workPriority": "高"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 日记内容 |
| startTime | string | 是 | 开始时间 (ISO 8601) |
| endTime | string | 是 | 结束时间 (ISO 8601) |
| location | string | 否 | 地点 |
| tags | string[] | 否 | 标签数组 |
| workPriority | string | 否 | 优先级：高/中/低（默认：中） |

#### 更新日记

```
PUT /diaries/:id
```

**所需权限：** `diary:write` 或 `all`

#### 删除日记

```
DELETE /diaries/:id
```

**所需权限：** `diary:write` 或 `all`

---

### 待办接口

#### 获取待办列表

```
GET /todos
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态：待办/已完成/已放弃/已转交 |
| priority | string | 优先级：高/中/低 |
| page | number | 页码（默认：1） |
| limit | number | 每页数量（默认：20，最大：100） |

#### 创建待办

```
POST /todos
```

**所需权限：** `todo:write` 或 `all`

**请求体：**

```json
{
  "content": "完成API文档编写",
  "priority": "高",
  "dueDate": "2024-01-15T00:00:00Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 待办内容 |
| dueDate | string | 是 | 截止日期 (ISO 8601) |
| priority | string | 否 | 优先级：高/中/低（默认：中） |

#### 更新待办状态

```
PUT /todos/:id/status
```

**所需权限：** `todo:write` 或 `all`

**请求体：**

```json
{
  "status": "已完成",
  "reason": "提前完成"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 是 | 状态：待办/已完成/已放弃/已转交 |
| reason | string | 否 | 状态变更原因 |

---

### 总结接口

#### 获取总结列表

```
GET /summaries
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 类型：daily/weekly/monthly/yearly |
| page | number | 页码（默认：1） |
| limit | number | 每页数量（默认：10，最大：50） |

#### 获取总结详情

```
GET /summaries/:id
```

---

### 其他接口

#### 获取所有标签

```
GET /tags
```

#### 获取统计数据

```
GET /stats
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "diaries": {
      "total": 150,
      "thisMonth": 25
    },
    "todos": {
      "待办": 10,
      "已完成": 45,
      "已放弃": 5,
      "已转交": 3
    },
    "summaries": 30
  }
}
```

---

## 权限范围

API Key 可配置不同的权限范围：

| 范围 | 说明 |
|------|------|
| `all` | 完全访问所有接口 |
| `diary:read` | 读取日记数据 |
| `diary:write` | 创建、更新、删除日记 |
| `todo:read` | 读取待办数据 |
| `todo:write` | 创建、更新待办 |
| `summary:read` | 读取工作总结 |

---

## 错误码

| 状态码 | 错误 | 说明 |
|--------|------|------|
| 400 | Bad Request | 请求参数无效 |
| 401 | Unauthorized | API Key 缺失或无效 |
| 403 | Forbidden | API Key 没有所需权限 |
| 404 | Not Found | 资源不存在 |
| 429 | Too Many Requests | 请求频率过高 |
| 500 | Internal Server Error | 服务器错误 |

---

## 代码示例

### Python

```python
import requests

API_KEY = "wdk_your_api_key_here"
BASE_URL = "https://your-server.com/api/v1"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# 获取日记列表
response = requests.get(f"{BASE_URL}/diaries", headers=headers)
diaries = response.json()

# 创建新日记
new_diary = {
    "content": "完成了API集成工作",
    "startTime": "2024-01-01T09:00:00Z",
    "endTime": "2024-01-01T18:00:00Z",
    "tags": ["开发", "API"]
}
response = requests.post(f"{BASE_URL}/diaries", json=new_diary, headers=headers)
```

### JavaScript

```javascript
const API_KEY = "wdk_your_api_key_here";
const BASE_URL = "https://your-server.com/api/v1";

// 获取日记列表
const response = await fetch(`${BASE_URL}/diaries`, {
  headers: { "X-API-Key": API_KEY }
});
const data = await response.json();

// 创建新日记
const newDiary = {
  content: "完成了API集成工作",
  startTime: "2024-01-01T09:00:00Z",
  endTime: "2024-01-01T18:00:00Z",
  tags: ["开发", "API"]
};

const createResponse = await fetch(`${BASE_URL}/diaries`, {
  method: "POST",
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(newDiary)
});
```

### cURL

```bash
# 获取日记列表
curl -X GET "https://your-server.com/api/v1/diaries?page=1&limit=10" \
  -H "X-API-Key: wdk_your_api_key_here"

# 创建日记
curl -X POST "https://your-server.com/api/v1/diaries" \
  -H "X-API-Key: wdk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "完成了API集成工作",
    "startTime": "2024-01-01T09:00:00Z",
    "endTime": "2024-01-01T18:00:00Z",
    "tags": ["开发", "API"]
  }'
```

---

## 最佳实践

1. **安全存储 API Key**：不要将 API Key 提交到版本控制，使用环境变量或密钥管理服务。

2. **使用适当的权限**：只请求应用需要的权限范围。

3. **处理速率限制**：收到 429 响应时实现指数退避重试。

4. **设置过期时间**：对于临时集成，为 API Key 设置过期日期。

5. **定期轮换密钥**：定期更换 API Key 以提高安全性。
