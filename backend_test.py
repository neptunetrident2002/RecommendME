#!/usr/bin/env python3
"""
Backend API Testing for RecommendME V6
Tests health endpoint, cron endpoints, guest sessions, unsubscribe, and link events tracking.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime

# Configuration
BACKEND_URL = "https://pull-recommend.preview.emergentagent.com"
CRON_SECRET = "cron_secret_recommendme_v6_2026"
ADMIN_EMAIL = "admin@recommendme.app"
ADMIN_PASSWORD = "Admin123!"

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.admin_token = None
        self.guest_token = None
        self.guest_id = None
        self.test_results = []

    async def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} {test_name}"
        if details:
            result += f" - {details}"
        self.test_results.append(result)
        print(result)

    async def test_health_endpoint(self):
        """Test GET /health and /api/health endpoints"""
        try:
            # Test /api/health endpoint (this should work)
            response = await self.client.get(f"{BACKEND_URL}/api/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    await self.log_result("Health endpoint (/api/health)", True, f"Status: {data['status']}")
                    return True
                else:
                    await self.log_result("Health endpoint (/api/health)", False, f"Wrong status: {data}")
                    return False
            else:
                await self.log_result("Health endpoint (/api/health)", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            await self.log_result("Health endpoint (/api/health)", False, f"Exception: {str(e)}")
            return False

    async def test_cron_endpoints_auth(self):
        """Test cron endpoints require proper X-Cron-Secret header"""
        endpoints = [
            "/api/internal/cron/matching-queue",
            "/api/internal/cron/follow-expiry", 
            "/api/internal/cron/llm-fallback",
            "/api/internal/cron/cleanup"
        ]
        
        all_passed = True
        
        # Test without header (should return 403)
        for endpoint in endpoints:
            try:
                response = await self.client.post(f"{BACKEND_URL}{endpoint}")
                if response.status_code == 403:
                    await self.log_result(f"Cron auth test {endpoint} (no header)", True, "Correctly returned 403")
                else:
                    await self.log_result(f"Cron auth test {endpoint} (no header)", False, f"Expected 403, got {response.status_code}")
                    all_passed = False
            except Exception as e:
                await self.log_result(f"Cron auth test {endpoint} (no header)", False, f"Exception: {str(e)}")
                all_passed = False

        # Test with wrong header (should return 403)
        for endpoint in endpoints:
            try:
                response = await self.client.post(f"{BACKEND_URL}{endpoint}", 
                                                headers={"X-Cron-Secret": "wrong_secret"})
                if response.status_code == 403:
                    await self.log_result(f"Cron auth test {endpoint} (wrong header)", True, "Correctly returned 403")
                else:
                    await self.log_result(f"Cron auth test {endpoint} (wrong header)", False, f"Expected 403, got {response.status_code}")
                    all_passed = False
            except Exception as e:
                await self.log_result(f"Cron auth test {endpoint} (wrong header)", False, f"Exception: {str(e)}")
                all_passed = False

        # Test with correct header (should return 200 with processed count)
        for endpoint in endpoints:
            try:
                response = await self.client.post(f"{BACKEND_URL}{endpoint}", 
                                                headers={"X-Cron-Secret": CRON_SECRET})
                if response.status_code == 200:
                    data = response.json()
                    if "processed" in data:
                        await self.log_result(f"Cron endpoint {endpoint}", True, f"Processed: {data['processed']}")
                    else:
                        await self.log_result(f"Cron endpoint {endpoint}", False, f"Missing 'processed' field: {data}")
                        all_passed = False
                else:
                    await self.log_result(f"Cron endpoint {endpoint}", False, f"Status code: {response.status_code}, Response: {response.text}")
                    all_passed = False
            except Exception as e:
                await self.log_result(f"Cron endpoint {endpoint}", False, f"Exception: {str(e)}")
                all_passed = False

        return all_passed

    async def test_guest_session(self):
        """Test POST /api/auth/guest endpoint"""
        try:
            response = await self.client.post(f"{BACKEND_URL}/api/auth/guest", 
                                            json={"referral_source": "test_source"})
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["guest_id", "access_token", "user"]
                
                if all(field in data for field in required_fields):
                    user = data["user"]
                    if user.get("is_guest") == True:
                        self.guest_token = data["access_token"]
                        self.guest_id = data["guest_id"]
                        await self.log_result("Guest session creation", True, f"Guest ID: {self.guest_id}")
                        return True
                    else:
                        await self.log_result("Guest session creation", False, f"User is_guest not true: {user}")
                        return False
                else:
                    await self.log_result("Guest session creation", False, f"Missing required fields: {data}")
                    return False
            else:
                await self.log_result("Guest session creation", False, f"Status code: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            await self.log_result("Guest session creation", False, f"Exception: {str(e)}")
            return False

    async def test_unsubscribe_endpoint(self):
        """Test GET /api/unsubscribe endpoint with invalid token"""
        try:
            # Test with invalid token (should return 400)
            response = await self.client.get(f"{BACKEND_URL}/api/unsubscribe?uid=test_user_id&trigger=follow_warning&token=invalid_token")
            
            if response.status_code == 400:
                await self.log_result("Unsubscribe invalid token", True, "Correctly returned 400 for invalid token")
                return True
            else:
                await self.log_result("Unsubscribe invalid token", False, f"Expected 400, got {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            await self.log_result("Unsubscribe invalid token", False, f"Exception: {str(e)}")
            return False

    async def test_link_events_tracking(self):
        """Test POST /api/link-events endpoint (requires auth)"""
        if not self.guest_token:
            await self.log_result("Link events tracking", False, "No guest token available")
            return False
            
        try:
            response = await self.client.post(f"{BACKEND_URL}/api/link-events",
                                            json={"link_type": "rec_card", "event_type": "click"},
                                            headers={"Authorization": f"Bearer {self.guest_token}"})
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") == True:
                    await self.log_result("Link events tracking", True, "Successfully tracked link event")
                    return True
                else:
                    await self.log_result("Link events tracking", False, f"Unexpected response: {data}")
                    return False
            else:
                await self.log_result("Link events tracking", False, f"Status code: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            await self.log_result("Link events tracking", False, f"Exception: {str(e)}")
            return False

    async def test_link_events_no_auth(self):
        """Test POST /api/link-events endpoint without auth (should fail)"""
        try:
            response = await self.client.post(f"{BACKEND_URL}/api/link-events",
                                            json={"link_type": "rec_card", "event_type": "click"})
            
            if response.status_code == 401:
                await self.log_result("Link events no auth", True, "Correctly returned 401 without auth")
                return True
            else:
                await self.log_result("Link events no auth", False, f"Expected 401, got {response.status_code}")
                return False
        except Exception as e:
            await self.log_result("Link events no auth", False, f"Exception: {str(e)}")
            return False

    async def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting RecommendME V6 Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        print("=" * 60)

        # Run tests in order
        await self.test_health_endpoint()
        await self.test_cron_endpoints_auth()
        await self.test_guest_session()
        await self.test_unsubscribe_endpoint()
        await self.test_link_events_no_auth()
        await self.test_link_events_tracking()

        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result)
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result)
        
        for result in self.test_results:
            print(result)
            
        print(f"\nTotal Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        
        if failed == 0:
            print("🎉 All tests passed!")
        else:
            print(f"⚠️  {failed} test(s) failed")

        await self.client.aclose()
        return failed == 0

async def main():
    """Main test runner"""
    tester = BackendTester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)