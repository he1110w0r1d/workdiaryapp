# Work Diary API Documentation

## Overview

Work Diary provides a RESTful API that allows external applications (such as AI agents, automation tools, or other applications) to access and manage work diary data.

## Authentication

All API requests require authentication using an API Key. You can create API Keys in the user settings page of the web application.

### Header Authentication

Include your API Key in the request header:

```
X-API-Key: wdk_your_api_key_here
```

### Example Request

```bash
curl -X GET "https://your-server.com/api/v1/diaries" \
  -H "X-API-Key: wdk_your_api_key_here"
```

## Base URL

```
https://your-server.com/api/v1
```

## Response Format

All responses are in JSON format with the following structure:

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message"
}
```

## Rate Limiting

API requests are subject to rate limiting. If you exceed the rate limit, you will receive a `429 Too Many Requests` response.

---

## Endpoints

### Diaries

#### List Diaries

Retrieve a paginated list of diaries.

```
GET /diaries
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | string | Filter diaries from this date (ISO 8601 format) |
| endDate | string | Filter diaries until this date (ISO 8601 format) |
| search | string | Search in content, location, and tags |
| tags | string | Comma-separated list of tags to filter |
| priority | string | Filter by priority (高/中/低) |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Sort order: 'asc' or 'desc' (default: 'desc') |

**Response:**

```json
{
  "success": true,
  "data": {
    "diaries": [
      {
        "_id": "...",
        "content": "Today I completed...",
        "location": "Office",
        "startTime": "2024-01-01T09:00:00.000Z",
        "endTime": "2024-01-01T18:00:00.000Z",
        "tags": ["development", "meeting"],
        "workPriority": "高",
        "isTodo": false,
        "todoStatus": "待办",
        "createdAt": "2024-01-01T09:00:00.000Z",
        "updatedAt": "2024-01-01T18:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### Get Diary by ID

Retrieve a single diary by its ID.

```
GET /diaries/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "content": "Today I completed...",
    "location": "Office",
    "startTime": "2024-01-01T09:00:00.000Z",
    "endTime": "2024-01-01T18:00:00.000Z",
    "tags": ["development", "meeting"],
    "workPriority": "高",
    "isTodo": false,
    "todoStatus": "待办",
    "statusDescription": "",
    "createdAt": "2024-01-01T09:00:00.000Z",
    "updatedAt": "2024-01-01T18:00:00.000Z",
    "relatedTodo": null
  }
}
```

#### Create Diary

Create a new diary entry.

```
POST /diaries
```

**Required Scope:** `diary:write` or `all`

**Request Body:**

```json
{
  "content": "Today I completed the API development work",
  "location": "Office",
  "startTime": "2024-01-01T09:00:00.000Z",
  "endTime": "2024-01-01T18:00:00.000Z",
  "tags": ["development", "API"],
  "workPriority": "高"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Diary content |
| startTime | string | Yes | Start time (ISO 8601) |
| endTime | string | Yes | End time (ISO 8601) |
| location | string | No | Location |
| tags | string[] | No | Tags array |
| workPriority | string | No | Priority: 高/中/低 (default: 中) |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "content": "Today I completed the API development work",
    "location": "Office",
    "startTime": "2024-01-01T09:00:00.000Z",
    "endTime": "2024-01-01T18:00:00.000Z",
    "tags": ["development", "API"],
    "workPriority": "高",
    "createdAt": "2024-01-01T09:00:00.000Z"
  }
}
```

#### Update Diary

Update an existing diary.

```
PUT /diaries/:id
```

**Required Scope:** `diary:write` or `all`

**Request Body:**

All fields are optional. Only include fields you want to update.

```json
{
  "content": "Updated content",
  "tags": ["new-tag"]
}
```

#### Delete Diary

Soft-delete a diary (moves to recycle bin).

```
DELETE /diaries/:id
```

**Required Scope:** `diary:write` or `all`

**Response:**

```json
{
  "success": true,
  "message": "Diary deleted successfully"
}
```

---

### Todos

#### List Todos

Retrieve a paginated list of todos.

```
GET /todos
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: 待办/已完成/已放弃/已转交 |
| priority | string | Filter by priority: 高/中/低 |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Sort order: 'asc' or 'desc' (default: 'desc') |

**Response:**

```json
{
  "success": true,
  "data": {
    "todos": [
      {
        "_id": "...",
        "content": "Complete API documentation",
        "priority": "高",
        "status": "待办",
        "dueDate": "2024-01-15T00:00:00.000Z",
        "createdAt": "2024-01-01T09:00:00.000Z",
        "updatedAt": "2024-01-01T09:00:00.000Z",
        "relatedDiary": {
          "content": "...",
          "startTime": "..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

#### Create Todo

Create a new todo item.

```
POST /todos
```

**Required Scope:** `todo:write` or `all`

**Request Body:**

```json
{
  "content": "Complete API documentation",
  "priority": "高",
  "dueDate": "2024-01-15T00:00:00.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Todo content |
| dueDate | string | Yes | Due date (ISO 8601) |
| priority | string | No | Priority: 高/中/低 (default: 中) |

#### Update Todo Status

Update the status of a todo item.

```
PUT /todos/:id/status
```

**Required Scope:** `todo:write` or `all`

**Request Body:**

```json
{
  "status": "已完成",
  "reason": "Completed ahead of schedule"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Yes | New status: 待办/已完成/已放弃/已转交 |
| reason | string | No | Reason for status change |

---

### Summaries

#### List Summaries

Retrieve a paginated list of work summaries.

```
GET /summaries
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by type: daily/weekly/monthly/yearly |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10, max: 50) |

**Response:**

```json
{
  "success": true,
  "data": {
    "summaries": [
      {
        "_id": "...",
        "type": "daily",
        "date": "2024-01-01T00:00:00.000Z",
        "content": "# Daily Summary\n\n...",
        "statistics": {
          "totalEntries": 5,
          "totalTime": 480,
          "tagDistribution": {}
        },
        "isRead": false,
        "createdAt": "2024-01-02T01:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 30,
      "totalPages": 3
    }
  }
}
```

#### Get Summary by ID

Retrieve a single summary by its ID.

```
GET /summaries/:id
```

---

### Utility Endpoints

#### Get All Tags

Retrieve all unique tags used in diaries.

```
GET /tags
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tags": ["development", "meeting", "design", "review"]
  }
}
```

#### Get Statistics

Retrieve usage statistics.

```
GET /stats
```

**Response:**

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

## Error Codes

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid API Key |
| 403 | Forbidden | API Key doesn't have required scope |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Scopes

API Keys can be configured with different permission scopes:

| Scope | Description |
|-------|-------------|
| `all` | Full access to all endpoints |
| `diary:read` | Read diary data |
| `diary:write` | Create, update, delete diaries |
| `todo:read` | Read todo data |
| `todo:write` | Create, update todos |
| `summary:read` | Read summaries |

---

## Code Examples

### Python

```python
import requests

API_KEY = "wdk_your_api_key_here"
BASE_URL = "https://your-server.com/api/v1"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Get diaries
response = requests.get(f"{BASE_URL}/diaries", headers=headers)
diaries = response.json()

# Create a new diary
new_diary = {
    "content": "Completed API integration",
    "startTime": "2024-01-01T09:00:00Z",
    "endTime": "2024-01-01T18:00:00Z",
    "tags": ["development", "API"]
}
response = requests.post(f"{BASE_URL}/diaries", json=new_diary, headers=headers)
```

### JavaScript/Node.js

```javascript
const API_KEY = "wdk_your_api_key_here";
const BASE_URL = "https://your-server.com/api/v1";

// Get diaries
const response = await fetch(`${BASE_URL}/diaries`, {
  headers: {
    "X-API-Key": API_KEY
  }
});
const data = await response.json();

// Create a new diary
const newDiary = {
  content: "Completed API integration",
  startTime: "2024-01-01T09:00:00Z",
  endTime: "2024-01-01T18:00:00Z",
  tags: ["development", "API"]
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
# Get diaries
curl -X GET "https://your-server.com/api/v1/diaries?page=1&limit=10" \
  -H "X-API-Key: wdk_your_api_key_here"

# Create a diary
curl -X POST "https://your-server.com/api/v1/diaries" \
  -H "X-API-Key: wdk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Completed API integration",
    "startTime": "2024-01-01T09:00:00Z",
    "endTime": "2024-01-01T18:00:00Z",
    "tags": ["development", "API"]
  }'
```

---

## Best Practices

1. **Store API Keys Securely**: Never commit API keys to version control. Use environment variables or secure secret management.

2. **Use Appropriate Scopes**: Request only the permissions your application needs.

3. **Handle Rate Limits**: Implement exponential backoff when receiving 429 responses.

4. **Set Expiration Dates**: For temporary integrations, set an expiration date on your API key.

5. **Monitor Usage**: Regularly check your API key usage in the settings page.

6. **Rotate Keys**: Periodically rotate your API keys for security.
