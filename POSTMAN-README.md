# KNUST Chatbot API - Postman Collection

This directory contains comprehensive Postman collections and environments for testing the KNUST Chatbot Backend API.

## 📁 Files Included

- `KNUST-Chatbot-API.postman_collection.json` - Complete API collection
- `KNUST-Chatbot-Development.postman_environment.json` - Development environment
- `KNUST-Chatbot-Production.postman_environment.json` - Production environment
- `run-api-tests.sh` - Automated test runner script

## 🚀 Quick Start

### Option 1: Import into Postman GUI

1. Open Postman
2. Click "Import" button
3. Import the collection file: `KNUST-Chatbot-API.postman_collection.json`
4. Import the environment file: `KNUST-Chatbot-Development.postman_environment.json`
5. Select the environment from the dropdown in top-right corner
6. Run the "Sign In (Primary Method)" request from the Authentication folder
7. Start testing other endpoints

### Option 2: Run via Command Line (Newman)

```bash
# Install Newman if not already installed
npm install -g newman

# Run all tests
./run-api-tests.sh

# Run tests against production environment
./run-api-tests.sh production
```

## 🔐 Authentication Flow

The collection includes multiple authentication methods:

### 1. Standard Email/Password Authentication
- **Sign Up**: Create new user account
- **Sign In**: Get ID token and refresh token
- **Refresh Token**: Renew expired ID token
- **Logout**: Revoke tokens

### 2. Custom Token Authentication
- **Exchange Custom Token**: Convert custom token to ID token using Firebase REST API
- Endpoint: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={{firebaseApiKey}}`

### 3. Test Credentials
- **Email**: `officialjwise20@gmail.com`
- **Password**: `Amoako@21`
