#!/bin/bash

echo "🚀 Backend Başlatılıyor..."
echo ""

cd "$(dirname "$0")"

# .env dosyasının varlığını kontrol et
if [ ! -f .env ]; then
    echo "❌ .env dosyası bulunamadı!"
    exit 1
fi

# Python interpreter'ı belirle (anaconda varsa onu kullan)
if command -v python &> /dev/null; then
    PYTHON_CMD=python
    echo "✅ Anaconda Python kullanılıyor"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
    echo "✅ Sistem Python3 kullanılıyor"
else
    echo "❌ Python bulunamadı!"
    exit 1
fi

echo "🔍 Python: $($PYTHON_CMD --version)"
echo "📦 Paketler kontrol ediliyor..."

# Paketlerin yüklü olup olmadığını kontrol et
if ! $PYTHON_CMD -c "import fastapi, uvicorn" 2>/dev/null; then
    echo "⚠️  Gerekli paketler bulunamadı, yükleniyor..."
    $PYTHON_CMD -m pip install -r requirements.txt
fi

# httpx'in yüklü olduğundan emin ol
if ! $PYTHON_CMD -c "import httpx" 2>/dev/null; then
    echo "⚠️  httpx yükleniyor..."
    $PYTHON_CMD -m pip install httpx
fi

# Tüm paketleri kontrol et
echo "🔍 Paketler doğrulanıyor..."
$PYTHON_CMD -c "import fastapi, uvicorn, httpx, dotenv; print('✅ Tüm paketler hazır')" || {
    echo "❌ Paket yükleme hatası!"
    exit 1
}

echo ""
echo "✅ Backend başlatılıyor..."
echo "📡 URL: http://localhost:8000"
echo "📚 Docs: http://localhost:8000/docs"
echo ""
echo "Durdurmak için CTRL+C tuşlarına basın"
echo ""

$PYTHON_CMD -m uvicorn server:app --reload --port 8000

