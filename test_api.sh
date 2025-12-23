#!/bin/bash

echo "🚀 API Test Script"
echo "=================="
echo ""

# Backend'in çalışıp çalışmadığını kontrol et
if ! curl -s http://localhost:8000/api/test > /dev/null 2>&1; then
    echo "❌ Backend çalışmıyor! Önce backend'i başlatın:"
    echo "   cd backend && uvicorn server:app --reload --port 8000"
    exit 1
fi

echo "✅ Backend çalışıyor!"
echo ""

# Test 1: API Bağlantı Testi
echo "📡 Test 1: API Bağlantı Testi"
echo "----------------------------"
curl -s http://localhost:8000/api/test | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8000/api/test
echo ""
echo ""

# Test 2: Maçları Getir
echo "⚽ Test 2: Maçları Getir (match_type=1)"
echo "---------------------------------------"
curl -s "http://localhost:8000/api/matches?match_type=1" | python3 -m json.tool 2>/dev/null || curl -s "http://localhost:8000/api/matches?match_type=1"
echo ""
echo ""

# Test 3: Canlı Maçlar
echo "🔥 Test 3: Canlı Maçlar"
echo "----------------------"
curl -s "http://localhost:8000/api/matches/live?match_type=1" | python3 -m json.tool 2>/dev/null || curl -s "http://localhost:8000/api/matches/live?match_type=1"
echo ""
echo ""

echo "✅ Testler tamamlandı!"
