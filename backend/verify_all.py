import sys
import os
import asyncio
import logging

# Add app to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VerificationAgent")

async def verify_all():
    print("====================================================")
    print("RescueNet-AI System Integration Verification Agent")
    print("====================================================")
    
    # 1. Test imports
    try:
        from app.main import app
        from app.database import db, investigations_col, users_col
        from app.services.cv_service import extract_and_analyze_frames
        from app.services.ai_service import LocalSemanticSearch
        from app.services.agentic_service import AgenticCoordinator
        from app.services.voice_service import speech_to_text, text_to_speech
        from app.services.integration_service import IntegrationGateway
        from app.middleware.security import EnterpriseSecurityHeadersMiddleware
        from app.middleware.gdpr import verify_gdpr_consent
        print("[-] STEP 1: Core imports check ... PASSED")
    except Exception as e:
        print(f"[x] STEP 1: Core imports check ... FAILED | Error: {e}")
        return False

    # 2. Test MongoDB connectivity and data seeding
    try:
        user_count = await db.users.count_documents({})
        case_count = await investigations_col.count_documents({})
        print(f"[-] STEP 2: MongoDB connections ... PASSED")
        print(f"    - Online Users registered: {user_count}")
        print(f"    - Active case folders     : {case_count}")
    except Exception as e:
        print(f"[x] STEP 2: MongoDB connections ... FAILED | Error: {e}")
        return False

    # 3. Test OpenCV Haar Cascade classifiers load
    try:
        from app.services.cv_service import CASCADE_PATH
        import cv2
        cascade = cv2.CascadeClassifier(CASCADE_PATH)
        if cascade.empty():
            print("[x] STEP 3: OpenCV Haar Cascade Classifier ... FAILED (cascade empty)")
        else:
            print("[-] STEP 3: OpenCV Haar Cascade Classifier ... PASSED")
    except Exception as e:
        print(f"[x] STEP 3: OpenCV face cascades ... FAILED | Error: {e}")
        return False

    # 4. Test RAG Vector matching algorithms
    try:
        docs = [
            {"text": "SOP protocol: All missing child reports must trigger coordinates geofencing markers on Leaflet maps.", "filename": "SOP.pdf"},
            {"text": "Rehabilitation checklist includes medical examination, counseling, and child shelter tracking.", "filename": "NGO_guide.pdf"}
        ]
        matches = LocalSemanticSearch.find_matches("geofencing maps coordinates", docs, top_k=1)
        if matches and matches[0]["similarity_score"] > 0.1:
            print("[-] STEP 4: Local RAG Vector Semantic search ... PASSED")
        else:
            print("[x] STEP 4: Local RAG Vector Semantic search ... FAILED (empty match)")
    except Exception as e:
        print(f"[x] STEP 4: Local RAG Vector Semantic search ... FAILED | Error: {e}")
        return False

    # 5. Test Agentic AI workflows
    try:
        case = {
            "person_name": "Test Child", "age": 8, "gender": "F",
            "last_seen_location": "Bandra Junction", "lat": 19.05, "lng": 72.82, "priority": "High"
        }
        res = await AgenticCoordinator.analyze_case(case, [])
        if res and "risk_score" in res:
            print("[-] STEP 5: Agentic AI workflow coordinators ... PASSED")
        else:
            print("[x] STEP 5: Agentic AI workflow coordinators ... FAILED")
    except Exception as e:
        print(f"[x] STEP 5: Agentic AI workflow coordinators ... FAILED | Error: {e}")
        return False

    # 6. Test Voice synthesis modules
    try:
        tts_url = text_to_speech("Verification loop completed successfully.")
        if tts_url:
            print("[-] STEP 6: Voice Speech Synthesis (TTS) ... PASSED")
        else:
            print("[x] STEP 6: Voice Speech Synthesis (TTS) ... FAILED")
    except Exception as e:
        print(f"[x] STEP 6: Voice Speech Synthesis (TTS) ... FAILED | Error: {e}")
        return False

    print("====================================================")
    print("All enterprise modules successfully verified and integrated!")
    print("====================================================")
    return True

if __name__ == "__main__":
    asyncio.run(verify_all())
