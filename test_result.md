#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Complete the RecommendME V6 build with missing features from previous session:
  1. HTTP cron endpoints - DONE
  2. Keep-alive endpoint - DONE
  3. Resend email integration with all triggers - DONE
  4. Google OAuth - DONE  
  5. Anonymous guest sessions - DONE
  6. Referral source capture - DONE
  7. OG link preview proxy - DONE
  8. Shareable cards (html2canvas) - DONE
  9. Deployment configuration - DONE
  10. PRD update - DONE

backend:
  - task: "Health endpoint"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "GET /health and GET /api/health return status ok"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: Health endpoint working correctly at /api/health. Returns proper JSON with status ok. Note: /health returns frontend HTML due to routing."

  - task: "Cron endpoints with CRON_SECRET auth"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "All 4 cron endpoints implemented with proper auth"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: All 4 cron endpoints working correctly. Auth properly enforced (403 without/wrong header, 200 with correct X-Cron-Secret). All endpoints return processed count as expected."

  - task: "Email triggers at correct moments"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "All email triggers added as background tasks"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: Email integration properly implemented with background tasks. Resend integration configured correctly."

  - task: "Unsubscribe endpoint"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "GET and POST /api/unsubscribe with token verification"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: Unsubscribe endpoint working correctly. Properly validates tokens and returns 400 for invalid tokens as expected."

  - task: "LLM fallback rate limiting"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "24h rate limit per user for LLM fallback"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: LLM fallback system implemented correctly with proper rate limiting logic and cron job integration."

  - task: "Guest session with referral capture"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "POST /auth/guest accepts referral_source"
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: Guest session creation working perfectly. Returns guest_id, access_token, and user object with is_guest=true. Referral source properly captured."

  - task: "Link events tracking endpoint"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "✅ VERIFIED: POST /api/link-events endpoint working correctly. Requires authentication (returns 401 without auth), accepts link_type and event_type parameters, returns ok response."

frontend:
  - task: "Landing page guest CTA"
    implemented: true
    working: true
    file: "LandingPage.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Try it - no account needed button added"

  - task: "ShareCard link event tracking"
    implemented: true
    working: true
    file: "ShareCard.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "API call to /link-events on card generation"

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Cron endpoints with CRON_SECRET auth"
    - "Guest session with referral capture"
    - "Email triggers at correct moments"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Completed all missing features from V6 prompt. Ready for backend testing to verify cron endpoints, email triggers, guest sessions, and unsubscribe functionality."
  - agent: "testing"
    message: "✅ BACKEND TESTING COMPLETE: All 17 tests passed successfully! Verified: Health endpoint (/api/health), all 4 cron endpoints with proper CRON_SECRET auth, guest session creation with referral capture, unsubscribe endpoint validation, and link events tracking with authentication. All backend APIs are working correctly and ready for production."