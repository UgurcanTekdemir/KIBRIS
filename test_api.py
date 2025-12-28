#!/usr/bin/env python3
"""
API Test Script
Tests Sportmonks API endpoints and displays statistics
"""
import requests
import json
from datetime import datetime, timedelta
from collections import defaultdict

BASE_URL = "http://localhost:8000/api"

def test_endpoint(endpoint, description):
    """Test an API endpoint and return the response"""
    print(f"\n{'='*60}")
    print(f"Testing: {description}")
    print(f"Endpoint: {endpoint}")
    print(f"{'='*60}")
    
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=120)
        response.raise_for_status()
        data = response.json()
        
        # Health endpoint doesn't have success field
        if endpoint == "/health":
            print(f"✅ {data.get('status', 'OK')}")
            return data
        
        if data.get("success"):
            return data.get("data", [])
        else:
            print(f"❌ API returned success=False")
            return []
    except requests.exceptions.RequestException as e:
        print(f"❌ Error: {e}")
        return []
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return []

def analyze_matches(matches):
    """Analyze matches and return statistics"""
    stats = {
        "total_matches": len(matches),
        "live_matches": 0,
        "finished_matches": 0,
        "upcoming_matches": 0,
        "matches_with_odds": 0,
        "total_odds": 0,
        "odds_by_market": defaultdict(int),
        "matches_by_league": defaultdict(int),
    }
    
    for match in matches:
        # Count match status
        if match.get("is_live"):
            stats["live_matches"] += 1
        elif match.get("is_finished"):
            stats["finished_matches"] += 1
        else:
            stats["upcoming_matches"] += 1
        
        # Count odds
        odds = match.get("odds", [])
        if odds and len(odds) > 0:
            stats["matches_with_odds"] += 1
            stats["total_odds"] += len(odds)
            
            # Count odds by market
            for odd in odds:
                market_name = odd.get("market_name") or odd.get("market_description") or "Unknown"
                stats["odds_by_market"][market_name] += 1
        
        # Count by league
        league = match.get("league") or "Unknown League"
        stats["matches_by_league"][league] += 1
    
    return stats

def print_statistics(stats):
    """Print statistics in a formatted way"""
    print(f"\n{'='*60}")
    print("📊 İSTATİSTİKLER")
    print(f"{'='*60}")
    
    print(f"\n🎯 MAÇ İSTATİSTİKLERİ:")
    print(f"  • Toplam Maç: {stats['total_matches']}")
    print(f"  • Canlı Maçlar: {stats['live_matches']}")
    print(f"  • Biten Maçlar: {stats['finished_matches']}")
    print(f"  • Yaklaşan Maçlar: {stats['upcoming_matches']}")
    
    print(f"\n💰 ODD İSTATİSTİKLERİ:")
    print(f"  • Odds Olan Maçlar: {stats['matches_with_odds']}")
    print(f"  • Toplam Odds Sayısı: {stats['total_odds']}")
    
    if stats['matches_with_odds'] > 0:
        avg_odds = stats['total_odds'] / stats['matches_with_odds']
        print(f"  • Maç Başına Ortalama Odds: {avg_odds:.2f}")
    
    if stats['odds_by_market']:
        print(f"\n📈 MARKET BAZINDA ODD DAĞILIMI:")
        sorted_markets = sorted(stats['odds_by_market'].items(), key=lambda x: x[1], reverse=True)
        for market, count in sorted_markets[:10]:  # Top 10
            print(f"  • {market}: {count} odds")
    
    if stats['matches_by_league']:
        print(f"\n🏆 LİG BAZINDA MAÇ DAĞILIMI:")
        sorted_leagues = sorted(stats['matches_by_league'].items(), key=lambda x: x[1], reverse=True)
        for league, count in sorted_leagues[:10]:  # Top 10
            print(f"  • {league}: {count} maç")

def print_sample_matches(matches, count=5):
    """Print sample matches with their odds"""
    print(f"\n{'='*60}")
    print(f"📋 ÖRNEK MAÇLAR (İlk {count})")
    print(f"{'='*60}")
    
    for i, match in enumerate(matches[:count], 1):
        print(f"\n{i}. {match.get('home_team', 'N/A')} vs {match.get('away_team', 'N/A')}")
        print(f"   Lig: {match.get('league', 'N/A')}")
        print(f"   Durum: {match.get('status', 'N/A')}")
        if match.get('is_live'):
            print(f"   ⚡ CANLI - {match.get('minute', '?')}'")
        elif match.get('is_finished'):
            print(f"   ✅ BİTTİ")
        else:
            print(f"   ⏰ {match.get('commence_time', 'N/A')}")
        
        odds = match.get("odds", [])
        if odds:
            print(f"   💰 Odds: {len(odds)} adet")
            # Group odds by market
            markets = defaultdict(list)
            for odd in odds:
                market = odd.get("market_name") or odd.get("market_description") or "Unknown"
                markets[market].append(odd)
            
            for market, market_odds in list(markets.items())[:3]:  # Show first 3 markets
                print(f"      • {market}: {len(market_odds)} seçenek")
        else:
            print(f"   💰 Odds: Yok")

def main():
    print("🚀 API Test Script Başlatılıyor...")
    print(f"📍 Base URL: {BASE_URL}")
    
    # Test health endpoint
    health_data = test_endpoint("/health", "Health Check")
    if health_data and health_data.get("status") == "healthy":
        print("✅ Backend çalışıyor!")
    else:
        print("❌ Backend'e bağlanılamıyor!")
        return
    
    # Test matches endpoint
    today = datetime.now().strftime("%Y-%m-%d")
    next_week = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    matches = test_endpoint(f"/matches?date_from={today}&date_to={next_week}", "Tüm Maçlar (Bugün + 7 Gün)")
    
    if matches:
        print(f"✅ {len(matches)} maç bulundu")
        
        # Analyze matches
        stats = analyze_matches(matches)
        print_statistics(stats)
        
        # Print sample matches
        print_sample_matches(matches, count=5)
    else:
        print("❌ Maç verisi alınamadı!")
    
    # Test live matches
    live_matches = test_endpoint("/matches/live", "Canlı Maçlar")
    if live_matches:
        print(f"\n✅ {len(live_matches)} canlı maç bulundu")
    else:
        print(f"\n⚠️  Canlı maç bulunamadı")
    
    # Test leagues
    leagues = test_endpoint("/leagues", "Ligler")
    if leagues:
        print(f"\n✅ {len(leagues)} lig bulundu")
    
    # Test a specific match with odds
    if matches:
        first_match_id = matches[0].get("id") or matches[0].get("sportmonks_id")
        if first_match_id:
            print(f"\n{'='*60}")
            print(f"🔍 ÖRNEK MAÇ DETAYLARI (ID: {first_match_id})")
            print(f"{'='*60}")
            match_detail = test_endpoint(f"/matches/{first_match_id}", f"Maç Detayları - {first_match_id}")
            if match_detail:
                odds = match_detail.get("odds", [])
                print(f"\n💰 Bu maçta {len(odds)} odds bulundu")
                if odds:
                    print(f"\n📊 İlk 5 Odds:")
                    for i, odd in enumerate(odds[:5], 1):
                        market = odd.get("market_name") or odd.get("market_description") or "Unknown"
                        label = odd.get("label") or odd.get("name") or "N/A"
                        value = odd.get("value") or odd.get("odd") or odd.get("price") or "N/A"
                        print(f"  {i}. {market} - {label}: {value}")
            
            # Test odds endpoint directly
            odds_data = test_endpoint(f"/matches/{first_match_id}/odds", f"Odds Endpoint - {first_match_id}")
            if odds_data:
                print(f"\n💰 Odds endpoint'inden {len(odds_data)} odds döndü")
                if odds_data:
                    print(f"\n📊 İlk 5 Odds (Odds Endpoint):")
                    for i, odd in enumerate(odds_data[:5], 1):
                        market = odd.get("market_name") or odd.get("market_description") or odd.get("market", {}).get("name", "Unknown")
                        label = odd.get("label") or odd.get("name") or "N/A"
                        value = odd.get("value") or odd.get("odd") or odd.get("price") or "N/A"
                        print(f"  {i}. {market} - {label}: {value}")
    
    print(f"\n{'='*60}")
    print("✅ Test tamamlandı!")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
