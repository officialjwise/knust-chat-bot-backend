#!/bin/bash

# KNUST Chatbot API Test Runner
# This script runs the Postman collection using Newman (Postman's CLI tool)

echo "🚀 KNUST Chatbot API Test Runner"
echo "=================================="

# Check if Newman is installed
if ! command -v newman &> /dev/null; then
    echo "❌ Newman is not installed. Installing Newman..."
    npm install -g newman
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Newman. Please install it manually:"
        echo "   npm install -g newman"
        exit 1
    fi
fi

# Check if collection file exists
COLLECTION_FILE="KNUST-Chatbot-API.postman_collection.json"
ENV_FILE="KNUST-Chatbot-Development.postman_environment.json"

if [ ! -f "$COLLECTION_FILE" ]; then
    echo "❌ Collection file not found: $COLLECTION_FILE"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

# Set environment (default to development)
ENVIRONMENT=${1:-development}

if [ "$ENVIRONMENT" = "production" ]; then
    ENV_FILE="KNUST-Chatbot-Production.postman_environment.json"
fi

echo "🌍 Environment: $ENVIRONMENT"
echo "📁 Collection: $COLLECTION_FILE"
echo "⚙️  Environment File: $ENV_FILE"
echo ""

# Run the tests
echo "🧪 Running API tests..."
echo "========================"

newman run "$COLLECTION_FILE" \
    --environment "$ENV_FILE" \
    --reporters cli,html \
    --reporter-html-export "test-results-$(date +%Y%m%d-%H%M%S).html" \
    --delay-request 1000 \
    --timeout-request 30000 \
    --bail \
    --color on

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed successfully!"
    echo "📊 Test report generated in HTML format"
else
    echo ""
    echo "❌ Some tests failed. Check the output above for details."
    exit 1
fi
