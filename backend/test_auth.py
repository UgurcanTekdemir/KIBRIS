"""
Test script to check NosyAPI authentication
"""
import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv('NOSY_API_TOKEN', '')
BASE_URL = "https://www.nosyapi.com/apiv2/service"

async def test_auth_methods():
    """Test different authentication methods"""
    
    endpoint = "bettable-matches/type"
    url = f"{BASE_URL}/{endpoint}"
    
    # Method 1: Bearer token in Authorization header
    print("Testing Method 1: Bearer token in Authorization header")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"}
            response = await client.get(url, headers=headers)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                print(f"✅ SUCCESS with Bearer token!")
                print(f"Response: {response.json()}")
                return
            else:
                print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Method 2: X-API-Key header
    print("\nTesting Method 2: X-API-Key header")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"X-API-Key": TOKEN, "Accept": "application/json"}
            response = await client.get(url, headers=headers)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                print(f"✅ SUCCESS with X-API-Key!")
                print(f"Response: {response.json()}")
                return
            else:
                print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Method 3: API-Key header
    print("\nTesting Method 3: API-Key header")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"API-Key": TOKEN, "Accept": "application/json"}
            response = await client.get(url, headers=headers)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                print(f"✅ SUCCESS with API-Key!")
                print(f"Response: {response.json()}")
                return
            else:
                print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Method 4: Token as query parameter
    print("\nTesting Method 4: Token as query parameter")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"Accept": "application/json"}
            response = await client.get(url, headers=headers, params={"token": TOKEN})
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                print(f"✅ SUCCESS with query parameter!")
                print(f"Response: {response.json()}")
                return
            else:
                print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n❌ All authentication methods failed")
    print(f"Token length: {len(TOKEN)}")
    print(f"Token preview: {TOKEN[:10]}...{TOKEN[-10:]}")

if __name__ == "__main__":
    asyncio.run(test_auth_methods())

