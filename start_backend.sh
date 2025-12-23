#!/bin/bash

echo "🚀 Backend Başlatılıyor..."
echo ""

cd "$(dirname "$0")/backend"

# .env dosyasının varlığını kontrol et
if [ ! -f .env ]; then
    echo "❌ .env dosyası bulunamadı!"
    exit 1
fi

# Virtual environment kontrolü (opsiyonel)
if [ -d "venv" ]; then
    echo "📦 Virtual environment bulundu, aktif ediliyor..."
    source venv/bin/activate
fi

# Paketlerin yüklü olup olmadığını kontrol et
if ! python3 -c "import fastapi, uvicorn, httpx" 2>/dev/null; then
    echo "⚠️  Gerekli paketler bulunamadı, yükleniyor..."
    pip install -r requirements.txt
fi

echo "✅ Backend başlatılıyor..."
echo "📡 URL: http://localhost:8000"
echo "📚 Docs: http://localhost:8000/docs"
echo ""
echo "Durdurmak için CTRL+C tuşlarına basın"
echo ""

uvicorn server:app --reload --port 8000

