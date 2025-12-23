#!/bin/bash

echo "🚀 Backend Başlatılıyor (MongoDB olmadan)..."
echo ""

cd "$(dirname "$0")"

# Python interpreter'ı belirle
if command -v python &> /dev/null; then
    PYTHON_CMD=python
elif command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
else
    echo "❌ Python bulunamadı!"
    exit 1
fi

echo "🔍 Python: $($PYTHON_CMD --version)"

# Paketlerin yüklü olduğunu kontrol et
if ! $PYTHON_CMD -c "import fastapi, uvicorn, httpx" 2>/dev/null; then
    echo "⚠️  Gerekli paketler yükleniyor..."
    $PYTHON_CMD -m pip install fastapi uvicorn httpx python-dotenv
fi

echo ""
echo "✅ Backend başlatılıyor..."
echo "📡 URL: http://localhost:8000"
echo "📚 Docs: http://localhost:8000/docs"
echo "🧪 Test: http://localhost:8000/api/test"
echo ""
echo "MongoDB kullanılmıyor - sadece API test ediliyor"
echo ""
echo "Durdurmak için CTRL+C tuşlarına basın"
echo ""

$PYTHON_CMD -m uvicorn server:app --reload --port 8000

