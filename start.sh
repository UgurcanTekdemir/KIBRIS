#!/bin/bash

# KIBRIS Frontend Hızlı Başlatma Script'i

cd "$(dirname "$0")/frontend"

echo "🚀 Frontend sunucusu başlatılıyor..."
echo "📍 Port: 3001"
echo "🌐 Tarayıcıda http://localhost:3001 adresini açın"
echo ""

npm start

