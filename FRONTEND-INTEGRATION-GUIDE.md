# KNUST ChatBot Backend - Admin Panel Integration Guide

## Production Deployment
- **Base URL**: `https://knust-chat-bot-backend.onrender.com`
- **Status**: ✅ Live and Ready
- **Admin User**: `officialjwise20@gmail.com`
- **Password**: `Amoako@21`

## Authentication Flow

### 1. Sign In
```http
POST /signin
Content-Type: application/json

{
  "email": "officialjwise20@gmail.com",
  "password": "Amoako@21"
}
```

**Response:**
```json
{
  "user": {
    "uid": "user_id",
    "email": "officialjwise20@gmail.com",
    "emailVerified": true
  },
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "AOEOulZ...",
  "message": "Sign-in successful"
}
```

### 2. Include Token in Headers
```javascript
const headers = {
  'Authorization': `Bearer ${idToken}`
}
```

## Admin Panel Endpoints

### Authentication & User Info
- `GET /api/auth/me` - Get current user info and role
- `POST /signin` - Authenticate user
- `POST /signup` - Register new user
- `POST /forgot-password` - Reset password

### Dashboard & Analytics
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/analytics/popular-programs` - Most searched programs
- `GET /api/analytics/usage` - Usage analytics

### User Management
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get specific user details
- `PUT /api/users/:id` - Update user information
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/:id/chat-history` - Get user's chat history

### Chat Monitoring
- `GET /api/chats` - Get all chat messages
- `GET /api/chats/:id` - Get specific chat message

### System Management
- `GET /api/system/health` - System health check (admin only)
- `GET /health` - Public health check

### Chat API
- `POST /chat` - Send message to chatbot

```http
POST /chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "What programs does KNUST offer?",
  "sender": "user_id"
}
```

## Frontend Integration

### CORS Configuration
The backend is configured to accept requests from all origins with the following headers:
- `Authorization`
- `Content-Type`
- `X-Requested-With`

### Sample Frontend Code

```javascript
// Authentication
const signIn = async (email, password) => {
  const response = await fetch('https://knust-chat-bot-backend.onrender.com/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('authToken', data.idToken);
    return data;
  }
  throw new Error(data.error);
};

// Get dashboard stats
const getDashboardStats = async () => {
  const token = localStorage.getItem('authToken');
  const response = await fetch('https://knust-chat-bot-backend.onrender.com/api/dashboard/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    return await response.json();
  }
  throw new Error('Failed to fetch dashboard stats');
};

// Get users list
const getUsers = async () => {
  const token = localStorage.getItem('authToken');
  const response = await fetch('https://knust-chat-bot-backend.onrender.com/api/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    return await response.json();
  }
  throw new Error('Failed to fetch users');
};
```

## Admin Panel Features

### 1. Dashboard
- Total users count
- Popular programs analytics
- Usage statistics
- System health monitoring

### 2. User Management
- View all registered users
- Edit user information
- Delete users
- View individual user chat history

### 3. Chat Monitoring
- View all chat interactions
- Monitor bot responses
- Track user queries

### 4. System Health
- Firebase connection status
- Database connectivity
- API health checks

## Security Features

### Role-Based Access Control
- Admin endpoints require `admin` role
- JWT token verification for all protected routes
- User data isolation

### Data Protection
- Secure password handling via Firebase Auth
- Token-based authentication
- CORS protection

## Error Handling

### Common Response Codes
- `200` - Success
- `400` - Bad Request (missing fields)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### Error Response Format
```json
{
  "error": "Error message description"
}
```

## Production Status
✅ **All systems operational**
- Authentication: Working
- Admin endpoints: Working
- CORS: Configured
- Database: Connected
- ChatBot: Responding

Ready for frontend integration!
