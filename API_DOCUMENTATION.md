# BLUEORION QMS - API Documentation

**Version:** 2.0.0 | **Base URL:** `http://localhost:3000/api` | **Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Endpoints](#endpoints)
5. [Error Codes](#error-codes)
6. [Examples](#examples)
7. [Rate Limiting](#rate-limiting)

---

## Overview

BLUEORION QMS is a comprehensive Quality Management System for recruitment and welfare management. This API provides endpoints for:

- User authentication and authorization
- Document management (QMS)
- Welfare complaint tracking
- Applicant form submission
- System notifications
- Audit logging

**Key Features:**
- Role-based access control (RBAC)
- Comprehensive validation & error handling
- Standardized JSON responses
- Audit trail for all operations
- Real-time notifications

---

## Authentication

### Login

**Endpoint:** `POST /api/login`

**Request Body:**
```json
{
  "username": "blueorion.sg",
  "password": "Blue@2026!S"
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": 200,
  "message": "Login successful",
  "data": {
    "message": "Login successful",
    "role": "document_controller",
    "username": "blueorion.sg",
    "allowedModules": ["document-control", "welfare-monitoring"]
  },
  "timestamp": "2026-04-25T10:30:45.123Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "status": 401,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  },
  "timestamp": "2026-04-25T10:30:45.123Z"
}
```

**Available Demo Accounts:**
| Username | Password | Role |
|----------|----------|------|
| blueorion.sg | Blue@2026!S | document_controller |
| welfare.officer | Blue@Welfare2026 | welfare_officer |
| applicant1 | Applicant@2026 | applicant |
| president.blueorion | Blue@President2026 | president |

---

### Logout

**Endpoint:** `GET /api/logout` or `POST /api/logout`

Returns redirect to login page.

---

## Response Format

All API responses follow a standardized format:

### Success Response
```json
{
  "success": true,
  "status": 200,
  "message": "Operation successful",
  "data": { /* response data */ },
  "timestamp": "2026-04-25T10:30:45.123Z"
}
```

### Error Response
```json
{
  "success": false,
  "status": 400,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  },
  "timestamp": "2026-04-25T10:30:45.123Z"
}
```

---

## Endpoints

### System Information

#### Get API Info
**Endpoint:** `GET /api/info`

**Description:** Returns API version and available endpoints.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "BLUEORION QMS",
    "version": "2.0.0",
    "description": "Quality Management System for Recruitment & Welfare",
    "environment": "production",
    "endpoints": {
      "auth": "/api/login",
      "documents": "/api/qms-documents",
      "complaints": "/api/welfare-complaints",
      "applicants": "/api/applicant-form",
      "health": "/api/health"
    }
  }
}
```

#### Health Check
**Endpoint:** `GET /api/health`

**Description:** Check system health and get statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "qmsDocsCount": 45,
    "welfareComplaintsCount": 12,
    "applicantFormsCount": 28,
    "hiredWorkers": 1245,
    "uptime": 3600,
    "environment": "production"
  }
}
```

---

### Documents (QMS)

#### Upload Document

**Endpoint:** `POST /api/qms-documents/upload`

**Auth Required:** Yes (Role: `admin`)

**Content-Type:** `multipart/form-data`

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | Document file (max 50MB) |
| name | string | Yes | Document name (min 3 chars) |
| uploadedBy | string | No | Uploader name |
| categories | string | No | Comma-separated categories |
| tags | string | No | Comma-separated tags |

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/qms-documents/upload \
  -H "x-user-role: admin" \
  -F "file=@document.pdf" \
  -F "name=ISO 9001 Manual" \
  -F "uploadedBy=Admin User" \
  -F "categories=compliance,quality" \
  -F "tags=iso,quality"
```

**Response:**
```json
{
  "success": true,
  "status": 201,
  "message": "Document uploaded successfully",
  "data": {
    "id": "1703123445000",
    "name": "ISO 9001 Manual",
    "type": "application/pdf",
    "uploadedBy": "Admin User",
    "dateUploaded": "2026-04-25T10:30:45.123Z",
    "version": 1,
    "url": "/uploads/qms_docs/1703123445000-1234567890-document.pdf",
    "fileSize": 2048576,
    "categories": ["compliance", "quality"],
    "tags": ["iso", "quality"]
  }
}
```

#### Get Documents

**Endpoint:** `GET /api/qms-documents`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query |
| uploader | string | Filter by uploader |
| category | string | Filter by category |
| tag | string | Filter by tag |
| limit | number | Results per page (default: 100) |
| offset | number | Pagination offset (default: 0) |

**Example Request:**
```bash
curl "http://localhost:3000/api/qms-documents?q=iso&category=compliance&limit=20"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "1703123445000",
        "name": "ISO 9001 Manual",
        "type": "application/pdf",
        "uploadedBy": "Admin User",
        "dateUploaded": "2026-04-25T10:30:45.123Z",
        "version": 1,
        "url": "/uploads/qms_docs/1703123445000-1234567890-document.pdf",
        "categories": ["compliance"],
        "tags": ["iso"]
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 20,
      "offset": 0
    }
  }
}
```

---

### Welfare Complaints

#### Submit Complaint

**Endpoint:** `POST /api/welfare-complaints`

**Auth Required:** No

**Request Body:**
```json
{
  "applicantName": "John Doe",
  "location": "Singapore",
  "employerName": "Tech Corp Ltd",
  "agencyName": "Blueorion",
  "category": "Wage Issue",
  "urgency": "high",
  "description": "Not paid for 2 months"
}
```

**Urgency Levels:** `low`, `medium`, `high`, `critical`

**Response:**
```json
{
  "success": true,
  "status": 201,
  "message": "Complaint submitted successfully",
  "data": {
    "id": "1703123445000",
    "applicantName": "John Doe",
    "location": "Singapore",
    "employerName": "Tech Corp Ltd",
    "agencyName": "Blueorion",
    "category": "Wage Issue",
    "urgency": "high",
    "description": "Not paid for 2 months",
    "date": "2026-04-25T10:30:45.123Z",
    "status": "pending"
  }
}
```

#### Get Complaints

**Endpoint:** `GET /api/welfare-complaints`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (pending, resolved, etc) |
| urgency | string | Filter by urgency |
| limit | number | Results per page (default: 100) |
| offset | number | Pagination offset (default: 0) |

**Example Request:**
```bash
curl "http://localhost:3000/api/welfare-complaints?urgency=high&status=pending"
```

---

### Applicants

#### Submit Application

**Endpoint:** `POST /api/applicant-form`

**Auth Required:** No

**Request Body:**
```json
{
  "fullName": "Jane Smith",
  "email": "jane@example.com",
  "contact": "+65 9876 5432",
  "position": "Domestic Worker",
  "applicationDate": "2026-04-25",
  "notes": "Experienced caregiver"
}
```

**Validation Rules:**
- `fullName`: Required, non-empty
- `email`: Required, valid email format
- `contact`: Required, phone number
- `position`: Required, non-empty
- `applicationDate`: Required, ISO date format

**Response:**
```json
{
  "success": true,
  "status": 201,
  "message": "Application submitted successfully",
  "data": {
    "id": "1703123445000",
    "fullName": "Jane Smith",
    "email": "jane@example.com",
    "contact": "+65 9876 5432",
    "position": "Domestic Worker",
    "applicationDate": "2026-04-25",
    "notes": "Experienced caregiver",
    "submitted": "2026-04-25T10:30:45.123Z"
  }
}
```

#### Get Applications

**Endpoint:** `GET /api/applicant-form`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Results per page (default: 100) |
| offset | number | Pagination offset (default: 0) |

---

### Notifications

#### Get Notifications

**Endpoint:** `GET /api/notifications`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Max notifications (default: 100) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1703123445000-5678",
      "timestamp": 1703123445000,
      "type": "qms",
      "message": "Document: ISO 9001 Manual uploaded",
      "read": false
    }
  ]
}
```

#### Mark Notification as Read

**Endpoint:** `POST /api/notifications/:id/read`

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "1703123445000-5678",
    "read": true
  }
}
```

---

### Statistics & Monitoring

#### Get Dashboard Stats

**Endpoint:** `GET /api/dashboard-stats`

**Auth Required:** No

**Response:**
```json
{
  "success": true,
  "data": {
    "system": {
      "qmsDocsCount": 45,
      "welfareComplaintsCount": 12,
      "applicantFormsCount": 28,
      "documentsFolder": 150,
      "hiredWorkers": 1245,
      "uptime": 3600
    },
    "recentActivity": {
      "qmsDocs": [],
      "complaints": [],
      "applicants": []
    },
    "summary": {
      "totalDocuments": 195,
      "totalComplaints": 12,
      "totalApplicants": 28,
      "systemHealth": "Operational"
    }
  }
}
```

#### Get Audit Logs

**Endpoint:** `GET /api/qms-audit-logs`

**Auth Required:** Yes (Role: `admin`)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Max logs (default: 50) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-04-25T10:30:45.123Z",
      "user": "admin",
      "action": "document-upload",
      "details": {
        "name": "ISO 9001 Manual",
        "version": 1
      },
      "ip": "192.168.1.1"
    }
  ]
}
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_FIELDS` | 400 | Required fields missing |
| `INVALID_INPUT` | 400 | Invalid input format |
| `INVALID_EMAIL` | 400 | Invalid email format |
| `INVALID_URGENCY` | 400 | Invalid urgency level |
| `INVALID_CREDENTIALS` | 401 | Username/password incorrect |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT` | 429 | Too many requests |
| `FILE_TOO_LARGE` | 413 | File exceeds size limit |
| `UPLOAD_ERROR` | 500 | File upload failed |
| `ACCOUNT_LOCKED` | 429 | Account temporarily locked |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Examples

### JavaScript/Node.js

```javascript
// Login
async function login(username, password) {
  const res = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

// Submit Complaint
async function submitComplaint(data) {
  const res = await fetch('http://localhost:3000/api/welfare-complaints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Upload Document
async function uploadDocument(file, name) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('uploadedBy', 'Admin');
  
  const res = await fetch('http://localhost:3000/api/qms-documents/upload', {
    method: 'POST',
    headers: { 'x-user-role': 'admin' },
    body: formData
  });
  return res.json();
}
```

### Python

```python
import requests

# Login
response = requests.post('http://localhost:3000/api/login', json={
    'username': 'blueorion.sg',
    'password': 'Blue@2026!S'
})
print(response.json())

# Get Complaints
response = requests.get('http://localhost:3000/api/welfare-complaints?urgency=high')
print(response.json())
```

### cURL

```bash
# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"blueorion.sg","password":"Blue@2026!S"}'

# Get Stats
curl http://localhost:3000/api/health

# Submit Complaint
curl -X POST http://localhost:3000/api/welfare-complaints \
  -H "Content-Type: application/json" \
  -d '{
    "applicantName": "John Doe",
    "location": "Singapore",
    "employerName": "Tech Corp",
    "agencyName": "Blueorion",
    "category": "Wage",
    "urgency": "high",
    "description": "Not paid"
  }'
```

---

## Rate Limiting

- **Login Attempts:** 5 failed attempts → 10 minute lockout
- **File Size Limit:** 50MB per file
- **Request Body Limit:** 10MB
- **Response Pagination:** Default 100 items, max 1000

---

## Security

- ✓ Password hashing (SHA-256)
- ✓ CORS enabled
- ✓ Input sanitization (XSS protection)
- ✓ Rate limiting on authentication
- ✓ Audit logging for all operations
- ✓ Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)

---

## Support

For issues or questions:
- Email: support@blueorion.com
- Documentation: [Full README](README.md)
- GitHub: [Repository Link]
