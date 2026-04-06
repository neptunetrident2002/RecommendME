#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import os

class RecommendMEAPITester:
    def __init__(self):
        self.base_url = "https://pull-recommend.preview.emergentagent.com/api"
        self.session = requests.Session()
        self.admin_token = None
        self.user_token = None
        self.test_user_id = None
        self.test_rec_id = None
        self.test_match_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "error": details})

    def make_request(self, method, endpoint, data=None, headers=None, expected_status=200):
        """Make API request and return response"""
        url = f"{self.base_url}{endpoint}"
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        
        try:
            if method == "GET":
                response = self.session.get(url, headers=req_headers)
            elif method == "POST":
                response = self.session.post(url, json=data, headers=req_headers)
            elif method == "PUT":
                response = self.session.put(url, json=data, headers=req_headers)
            elif method == "DELETE":
                response = self.session.delete(url, headers=req_headers)
            
            success = response.status_code == expected_status
            return success, response
        except Exception as e:
            return False, str(e)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.make_request("POST", "/auth/login", {
            "email": "admin@recommendme.app",
            "password": "Admin123!"
        })
        
        if success and response.json().get("is_admin"):
            self.admin_token = response.json().get("access_token")
            # Don't update session headers here, we'll use specific headers for admin calls
            self.log_test("Admin Login", True)
            return True
        else:
            self.log_test("Admin Login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            return False

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        test_email = f"test_{timestamp}@test.com"
        
        success, response = self.make_request("POST", "/auth/register", {
            "email": test_email,
            "password": "TestPass123!",
            "display_name": "Test User",
            "city": "Test City"
        }, expected_status=200)
        
        if success:
            user_data = response.json()
            self.user_token = user_data.get("access_token")
            self.test_user_id = user_data.get("id")
            self.log_test("User Registration", True)
            return True
        else:
            self.log_test("User Registration", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            return False

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        success, response = self.make_request("GET", "/auth/me", headers=headers)
        
        if success and response.json().get("email"):
            self.log_test("Auth Me", True)
            return True
        else:
            self.log_test("Auth Me", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            return False

    def test_create_recommendation(self):
        """Test creating a recommendation"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        success, response = self.make_request("POST", "/recommendations", {
            "title": "Test Book",
            "author": "Test Author",
            "category": "read",
            "url": "https://example.com",
            "why_note": "This is a test recommendation with more than 20 characters to meet the minimum requirement."
        }, headers=headers, expected_status=200)
        
        if success:
            self.test_rec_id = response.json().get("id")
            self.log_test("Create Recommendation", True)
            return True
        else:
            self.log_test("Create Recommendation", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            return False

    def test_get_my_recommendations(self):
        """Test getting user's recommendations"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        success, response = self.make_request("GET", "/recommendations/mine", headers=headers)
        
        if success and isinstance(response.json(), list):
            self.log_test("Get My Recommendations", True)
            return True
        else:
            self.log_test("Get My Recommendations", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            return False

    def test_set_weekly_default(self):
        """Test setting weekly default recommendation"""
        if not self.test_rec_id:
            self.log_test("Set Weekly Default", False, "No recommendation ID available")
            return False
            
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        success, response = self.make_request("POST", "/recommendations/set-weekly-default", {
            "recommendation_id": self.test_rec_id,
            "category": "read"
        }, headers=headers)
        
        if success:
            self.log_test("Set Weekly Default", True)
            return True
        else:
            self.log_test("Set Weekly Default", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            return False

    def test_get_weekly_defaults(self):
        """Test getting weekly defaults"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        success, response = self.make_request("GET", "/recommendations/weekly-defaults", headers=headers)
        
        if success:
            data = response.json()
            # Check if it has the expected structure with read/listen/watch categories
            if isinstance(data, dict) and "read" in data and "listen" in data and "watch" in data:
                self.log_test("Get Weekly Defaults", True)
                return True
            else:
                self.log_test("Get Weekly Defaults", False, "Invalid response structure")
                return False
        else:
            self.log_test("Get Weekly Defaults", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            return False

    def test_matching_pool_operations(self):
        """Test matching pool operations"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        
        # Enter pool
        success, response = self.make_request("POST", "/matching/enter", {
            "category": "read",
            "recommendation_id": self.test_rec_id
        }, headers=headers)
        
        if success:
            self.log_test("Enter Matching Pool", True)
        else:
            self.log_test("Enter Matching Pool", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            return False

        # Check pool count - this endpoint doesn't exist, skip it
        # success, response = self.make_request("GET", "/matching/pool-count/read")
        # if success:
        #     self.log_test("Pool Count", True)
        # else:
        #     self.log_test("Pool Count", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")

        # Check match status
        success, response = self.make_request("GET", "/matching/check", headers=headers)
        if success:
            self.log_test("Check Match Status", True)
        else:
            self.log_test("Check Match Status", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")

        # Cancel matching
        success, response = self.make_request("POST", "/matching/cancel", headers=headers)
        if success:
            self.log_test("Cancel Matching", True)
        else:
            self.log_test("Cancel Matching", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")

        return True

    def test_shareable_link(self):
        """Test shareable link functionality"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        
        # Generate link
        success, response = self.make_request("POST", "/shareable-link/generate", headers=headers)
        if success:
            link_data = response.json()
            token = link_data.get("token")
            self.log_test("Generate Shareable Link", True)
            
            # Get link info
            success, response = self.make_request("GET", f"/shareable-link/{token}")
            if success:
                self.log_test("Get Shareable Link Info", True)
            else:
                self.log_test("Get Shareable Link Info", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
            
            # Submit via link
            success, response = self.make_request("POST", f"/shareable-link/{token}/submit", {
                "category": "read",
                "title": "Anonymous Recommendation",
                "author": "Anonymous Author",
                "why_note": "This is an anonymous recommendation with sufficient characters to meet the minimum requirement."
            })
            if success:
                self.log_test("Submit via Shareable Link", True)
            else:
                self.log_test("Submit via Shareable Link", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")
                
        else:
            self.log_test("Generate Shareable Link", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")

    def test_list_operations(self):
        """Test list operations"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        
        # Get list
        success, response = self.make_request("GET", "/list", headers=headers)
        if success:
            self.log_test("Get My List", True)
        else:
            self.log_test("Get My List", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")

        # Get list stats
        success, response = self.make_request("GET", "/list/stats", headers=headers)
        if success:
            self.log_test("Get List Stats", True)
        else:
            self.log_test("Get List Stats", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")

    def test_connections(self):
        """Test connections endpoint"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        success, response = self.make_request("GET", "/connections", headers=headers)
        
        if success:
            self.log_test("Get Connections", True)
        else:
            self.log_test("Get Connections", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")

    def test_admin_endpoints(self):
        """Test admin-only endpoints"""
        if not self.admin_token:
            self.log_test("Admin Endpoints", False, "No admin token available")
            return False
        
        # Create a fresh session for admin requests to avoid token conflicts
        admin_session = requests.Session()
        headers = {"Authorization": f"Bearer {self.admin_token}", "Content-Type": "application/json"}
        
        # Admin metrics
        try:
            response = admin_session.get(f"{self.base_url}/admin/metrics", headers=headers)
            if response.status_code == 200:
                self.log_test("Admin Metrics", True)
            else:
                self.log_test("Admin Metrics", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Admin Metrics", False, f"Exception: {str(e)}")

        # Admin users
        try:
            response = admin_session.get(f"{self.base_url}/admin/users", headers=headers)
            if response.status_code == 200:
                self.log_test("Admin Users", True)
            else:
                self.log_test("Admin Users", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Admin Users", False, f"Exception: {str(e)}")

        # Admin reports
        try:
            response = admin_session.get(f"{self.base_url}/admin/reports", headers=headers)
            if response.status_code == 200:
                self.log_test("Admin Reports", True)
            else:
                self.log_test("Admin Reports", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Admin Reports", False, f"Exception: {str(e)}")

    def test_logout(self):
        """Test logout"""
        headers = {"Authorization": f"Bearer {self.user_token}"} if self.user_token else {}
        success, response = self.make_request("POST", "/auth/logout", headers=headers)
        
        if success:
            self.log_test("Logout", True)
        else:
            self.log_test("Logout", False, f"Status: {response.status_code if hasattr(response, 'status_code') else 'Error'}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting RecommendME API Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print("-" * 50)

        # Auth tests
        if not self.test_admin_login():
            print("❌ Admin login failed - stopping admin tests")
        
        if not self.test_user_registration():
            print("❌ User registration failed - stopping user tests")
            return self.generate_report()
            
        self.test_auth_me()
        
        # Recommendation tests
        self.test_create_recommendation()
        self.test_get_my_recommendations()
        self.test_set_weekly_default()
        self.test_get_weekly_defaults()
        
        # Matching tests
        self.test_matching_pool_operations()
        
        # Other features
        self.test_shareable_link()
        self.test_list_operations()
        self.test_connections()
        
        # Admin tests
        if self.admin_token:
            self.test_admin_endpoints()
        
        # Cleanup
        self.test_logout()
        
        return self.generate_report()

    def generate_report(self):
        """Generate test report"""
        print("\n" + "=" * 50)
        print("📊 TEST RESULTS")
        print("=" * 50)
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {len(self.failed_tests)}/{self.tests_run}")
        
        if self.failed_tests:
            print("\n🔍 FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: {failure['error']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.failed_tests,
            "success_rate": success_rate
        }

def main():
    tester = RecommendMEAPITester()
    results = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if results["success_rate"] >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())