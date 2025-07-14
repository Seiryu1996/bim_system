#!/bin/bash

echo "=== BIM System Build Test ==="

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not available"
    exit 1
fi

# Test backend build
echo "1. Testing backend build..."
cd backend
echo "Building backend Docker image..."
docker build -f Dockerfile.simple -t bim-backend-test .
if [ $? -eq 0 ]; then
    echo "✓ Backend build successful"
    
    # Test if the binary runs
    echo "Testing backend binary..."
    docker run --rm bim-backend-test ./main --help 2>&1 | head -5
else
    echo "✗ Backend build failed"
    exit 1
fi

# Test frontend build
echo "2. Testing frontend build..."
cd ../frontend
echo "Building frontend Docker image..."
docker build -t bim-frontend-test .
if [ $? -eq 0 ]; then
    echo "✓ Frontend build successful"
else
    echo "✗ Frontend build failed"
    exit 1
fi

echo "=== All builds completed successfully ==="
echo "To run the system:"
echo "  docker-compose up -d"