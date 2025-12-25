#!/bin/bash

# Süperadmin Ekleme Scripti - Çalıştırma Helper

echo "🔐 Süperadmin Ekleme Scripti"
echo ""

# JSON dosya yolunu kontrol et
if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    # Proje klasöründe ara
    if [ -f "firebase-service-account-key.json" ]; then
        export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/firebase-service-account-key.json"
        echo "✅ JSON dosyası bulundu: $GOOGLE_APPLICATION_CREDENTIALS"
    elif [ -f "my-kibris-*.json" ]; then
        export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/my-kibris-*.json"
        echo "✅ JSON dosyası bulundu: $GOOGLE_APPLICATION_CREDENTIALS"
    else
        echo "❌ JSON dosyası bulunamadı!"
        echo ""
        echo "💡 Çözüm:"
        echo "1. JSON dosyasını proje klasörüne kopyalayın:"
        echo "   cp ~/Downloads/my-kibris-*.json ./firebase-service-account-key.json"
        echo ""
        echo "2. Veya environment variable ayarlayın:"
        echo "   export GOOGLE_APPLICATION_CREDENTIALS=\"/path/to/service-account-key.json\""
        echo ""
        exit 1
    fi
else
    echo "✅ JSON dosya yolu ayarlı: $GOOGLE_APPLICATION_CREDENTIALS"
fi

echo ""
echo "🚀 Süperadmin ekleniyor..."
echo ""

# Scripti çalıştır
node add-superadmin.js 456UK2q0sjOfRUTcROIXWhmvHAM2 admin@my-kibris.com superadmin

