# Admin Panel Endpoints Implementation

## 🚀 Overview
Updated the KNUST chatbot backend with comprehensive admin panel endpoints featuring role-based access control and analytics capabilities.

## 🔒 Authentication & Authorization

### Role-Based Access Control
- **Admin Middleware**: `requireAdmin` - Ensures only users with `role: 'admin'` can access admin endpoints
- **Enhanced Auth**: Updated `authenticateToken` to include user role from Firestore
- **Security**: All admin endpoints require both authentication and admin role

### User Roles
- `user` (default) - Standard chatbot access
- `admin` - Full admin panel access

## 📋 Implemented Endpoints

### 🔐 Authentication Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/logout` | User logout | ✅ Token |
| GET | `/api/auth/me` | Get current user info | ✅ Token |

### 👥 User Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | List all users (paginated) | ✅ Admin |
| GET | `/api/users/:id` | Get specific user details | ✅ Admin |
| PUT | `/api/users/:id` | Update user (name, role, status) | ✅ Admin |
| DELETE | `/api/users/:id` | Delete user account | ✅ Admin |
| GET | `/api/users/:id/chat-history` | Get user's chat history | ✅ Admin |

### 📊 Dashboard & Analytics
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/dashboard/stats` | Dashboard overview stats | ✅ Admin |
| GET | `/api/analytics/usage` | Chat usage analytics | ✅ Admin |
| GET | `/api/analytics/popular-programs` | Most mentioned programs | ✅ Admin |

### 💬 Chat Monitoring
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/chats` | List all chat interactions | ✅ Admin |
| GET | `/api/chats/:id` | Get specific chat details | ✅ Admin |

### ⚙️ System Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/system/health` | System health check | ✅ Admin |
| PUT | `/api/programs/:id` | Update program (future feature) | ✅ Admin |

## 📈 Analytics Features

### Dashboard Stats
- Total users count
- Total chat interactions
- Total FAQs
- Total programs available
- Recent activity (7 days)
- Active users

### Usage Analytics
- Daily chat usage over specified period
- Total chats in period
- Average daily usage
- Trend analysis

### Popular Programs
- Most mentioned programs in chats
- Mention frequency and percentages
- Configurable limit for top results

## 🔧 Technical Implementation

### Role Management
```javascript
// Set user as admin in Firestore
await admin.firestore().collection('users').doc(userId).update({
  role: 'admin'
});
```

### Error Handling
- Comprehensive error logging
- Proper HTTP status codes
- User-friendly error messages
- Admin-specific error details

### Performance Features
- Pagination for large datasets
- Efficient Firestore queries
- Memory usage monitoring
- Query result limiting

## 🛡️ Security Features

1. **Role-Based Access**: Only admin users can access admin endpoints
2. **Token Verification**: All endpoints require valid Firebase ID tokens
3. **Input Validation**: Proper validation of request parameters
4. **Error Masking**: Sensitive errors not exposed to client
5. **Audit Trail**: All admin actions logged

## 📚 Database Structure

### Users Collection
```javascript
{
  email: "user@example.com",
  name: "User Name",
  role: "admin|user",
  createdAt: timestamp,
  lastLogin: timestamp,
  isActive: boolean
}
```

### Chat History Collection
```javascript
{
  uid: "user_id",
  message: "user question",
  response: "bot response",
  timestamp: timestamp
}
```

## 🚦 Usage Examples

### Create Admin User
```javascript
// Set existing user as admin
const userId = "existing_user_id";
await admin.firestore().collection('users').doc(userId).update({
  role: 'admin'
});
```

### API Calls
```bash
# Get dashboard stats
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3000/api/dashboard/stats

# List users
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:3000/api/users?page=1&limit=20"

# Get user chat history
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3000/api/users/user123/chat-history
```

## 🔄 Future Enhancements

1. **Program Management**: Move programs from `data.js` to Firestore for dynamic updates
2. **Real-time Monitoring**: WebSocket connections for live chat monitoring
3. **Content Flagging**: Automated content moderation and flagging
4. **Export Features**: Export chat data and analytics to CSV/PDF
5. **Notification System**: Admin alerts for system issues
6. **Advanced Analytics**: User behavior patterns and conversion tracking

## ✅ Status

- ✅ **Authentication & Authorization** - Implemented
- ✅ **User Management** - Implemented
- ✅ **Dashboard Analytics** - Implemented
- ✅ **Chat Monitoring** - Implemented
- ✅ **System Health** - Implemented
- 🚧 **Program Management** - Placeholder (future)
- 🚧 **Advanced Features** - Future enhancements

The admin panel backend is now ready for frontend integration with comprehensive CRUD operations, analytics, and security features.
