# KNUST Chatbot Backend

## 🚀 Latest Enhancements (v2.0.0)

### ✅ Major Issues Fixed:
- **Computer Science Recognition**: Fixed chatbot not recognizing "Computer Science" queries
- **Career vs Admission Classification**: Now properly distinguishes between career questions and admission questions  
- **Enhanced Search**: Fixed college filtering and improved program search with fuzzy matching
- **Chat History Persistence**: All chat interactions now saved to user's history
- **Password Reset**: Fixed email delivery for password reset functionality

### 🔧 New Features:
- **Intelligent Query Processing**: Step-by-step query classification and response generation
- **Fuzzy Search**: Smart program name matching with typo tolerance
- **User Management**: Complete profile and aggregate calculation system
- **College Filtering**: Accurate search by college with proper program associations
- **Career Information**: GPT-powered responses for career and academic questions

### 📱 Mobile App Ready:
- Enhanced search endpoints with proper college filtering
- Chat history persistence for seamless user experience
- Comprehensive user profile management
- Accurate program information with fees and requirements

## Quick Start
```bash
npm install
npm start
```

## API Documentation
- **Swagger UI**: http://localhost:3000/api-docs
- **Postman Collection**: Available in project root
- **Health Check**: http://localhost:3000/health

## Test Coverage
Run comprehensive tests:
```bash
node test-classification.js    # Query classification
node test-search.js           # Enhanced search  
node test-complete-logic.js   # End-to-end flow
```

## Environment Setup
Ensure these environment variables are set:
- `FIREBASE_CREDENTIALS`: Firebase service account JSON
- `OPENAI_API_KEY`: OpenAI API key for GPT responses

---
**Created by Rockson Agyamaku** | Version 2.0.0
