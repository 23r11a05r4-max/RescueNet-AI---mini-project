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

user_problem_statement: Extend RescueNet-AI codebase with WebRTC video calling, Twilio SIP telephony hotline, multilingual STT/TTS auto-language detection, NumPy-based cosine semantic RAG vector index, specialized Agentic AI copilots, real-time telemetry monitors, human handoff ws, and GDPR consent check middleware.
backend:
  - task: "Modularize Backend Core"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Split backend logic into app/ routers, schemas, services, and middleware modules while keeping compatibility."
  - task: "Complete RBAC"
    implemented: true
    working: true
    file: "backend/app/middleware/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Enforced role checking on all API endpoints for Citizen, NGO, Police, and Admin."
  - task: "AI Chatbot & RAG"
    implemented: true
    working: true
    file: "backend/app/routers/ai.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Role-aware chat prompts, PDF extraction chunks, and NumPy local cosine similarity semantic search."
  - task: "WebRTC Audio/Video Signaling"
    implemented: true
    working: true
    file: "backend/app/routers/webrtc.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "WebSocket signaling rooms to relay peer SDP offers/answers and ICE candidate payloads."
  - task: "Twilio Telephony & SIP Gateway"
    implemented: true
    working: true
    file: "backend/app/routers/telephony.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Accepts emergency phone calls, logs call recording analytics, extracts sentiments, auto-creates cases, and speaks replies."
  - task: "Multilingual Voice Pipeline"
    implemented: true
    working: true
    file: "backend/app/services/voice_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Multilingual Speech-to-Text and Text-to-Speech support for English, Hindi, Telugu, Tamil, Kannada, and Malayalam."
  - task: "Agentic AI workflows"
    implemented: true
    working: true
    file: "backend/app/services/agentic_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "6 specialized sub-agents formulating prioritizations, search grid markers, findings, and rescue/rehabilitation plans."
  - task: "GDPR Consent & refreshes"
    implemented: true
    working: true
    file: "backend/app/middleware/gdpr.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "GDPR consent verify dependency, Right to be Forgotten account deletions, and refresh token logs."
  - task: "Security Headers Middleware"
    implemented: true
    working: true
    file: "backend/app/middleware/security.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Enterprise security headers middleware (XSS block, Clickjacking protection, and Content Security Policy rules)."

frontend:
  - task: "Enterprise Dashboards"
    implemented: true
    working: true
    file: "frontend/src/pages/Dashboard.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added live monitor cards displaying RAM/CPU server health, call analytics, and role workspaces."
  - task: "WebRTC Caller & Agentic Advisor panels"
    implemented: true
    working: true
    file: "frontend/src/pages/InvestigationDetail.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Toggles live WebRTC video streams and plots Agentic AI recommended coordinates on Leaflet maps."
  - task: "Chat copilot extensions"
    implemented: true
    working: true
    file: "frontend/src/components/AIChat.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Features language drop-down selector, sentiment meters, and Human Handoff live escalation routing."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "WebRTC Audio/Video Signaling"
    - "Twilio Telephony & SIP Gateway"
    - "Agentic AI workflows"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "All enterprise features and background tasks verified with passing unit tests. Code ready for cloud Docker deployments."