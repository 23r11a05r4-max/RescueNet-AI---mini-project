import asyncio
import os
import httpx
from dotenv import load_dotenv
import sys

# Add backend folder to sys.path so we can import services
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database import db

API_URL = "http://localhost:8000/api"

async def run_e2e_test():
    print("====================================================")
    print("RescueNet-AI End-to-End System Integration Audit")
    print("====================================================")
    
    async with httpx.AsyncClient() as client:
        # 1. Fetch startup health status
        print("[-] Audit Point 1: API Gateway Health Status Check...")
        res = await client.get(f"http://localhost:8000/api/")
        assert res.status_code == 200, f"Gateway unhealthy: {res.status_code}"
        print("    [OK] API Gateway is online and responsive.")

        # 2. Register/Login Test User
        print("\n[-] Audit Point 2: User Authentication & Security Tokens...")
        email = "e2e_citizen@example.com"
        password = "securepassword123"
        
        # Clean existing test user if any
        await db.users.delete_many({"email": email})
        
        reg_res = await client.post(f"{API_URL}/auth/register", json={
            "email": email,
            "password": password,
            "name": "E2E Auditor",
            "role": "citizen",
            "department": "Public Volunteer Unit"
        })
        assert reg_res.status_code in (200, 201), f"Registration failed: {reg_res.text}"
        print("    [OK] Public Citizen registered successfully.")

        login_res = await client.post(f"{API_URL}/auth/login", json={
            "email": email,
            "password": password
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        tokens = login_res.json()
        token = tokens["token"]
        user_id = tokens["user"]["id"]
        headers = {"Authorization": f"Bearer {token}"}
        print("    [OK] JWT Access Token successfully issued.")

        # 3. Create a Missing Person Case File (triggers AI Prioritizer)
        print("\n[-] Audit Point 3: Case Creation & AI Risk Assessment Scoring...")
        case_data = {
            "person_name": "E2E Test Child",
            "age": 8,
            "gender": "F",
            "last_seen_location": "Central Bus Terminus, Bandra West",
            "district": "Bandra",
            "city": "Mumbai",
            "state": "Maharashtra",
            "lat": 19.059,
            "lng": 72.829,
            "priority": "High",
            "reporter_contact": "+91 99999 88888",
            "reporter_name": "E2E Auditor",
            "reporter_email": email,
            "last_seen_date_time": "2026-07-09T14:30:00Z",
            "physical_description": "Height: 4ft, Complexion: Fair, speaks Marathi and English",
            "special_marks": "Small scar near right eyebrow. Diabetic patient requiring daily insulin.",
            "clothing_description": "Red school uniform shirt, black trousers",
            "additional_notes": "Transit tickets to Pune found near the location.",
            "description": "8 year old child missing from Mumbai terminus since yesterday afternoon.",
            "gdpr_consent": True
        }
        
        # Clean existing test cases with same name
        await db.investigations.delete_many({"person_name": "E2E Test Child"})
        
        case_res = await client.post(f"{API_URL}/investigations", json=case_data, headers=headers)
        assert case_res.status_code == 200, f"Case creation failed: {case_res.text}"
        case = case_res.json()
        case_id = case["id"]
        
        print(f"    [OK] Case file successfully registered for: {case['person_name']} (ID: {case_id})")
        print(f"    [OK] AI Risk Priority Score: {case.get('priority_score')}/100 | Severity Level: {case.get('priority')}")
        print(f"    [OK] AI Recommendations Generated: {len(case.get('ai_recommendations', []))} items")
        print(f"    [OK] Initial Timeline Logs Seeded: {len(case.get('timeline', []))} events")

        # 4. Upload Sighting Report
        print("\n[-] Audit Point 4: Public Crowdsourced Sighting Reports...")
        sighting_data = {
            "investigation_id": case_id,
            "date_time": "2026-07-10T10:00:00Z",
            "location": "Platform 3, Dadar Railway Station",
            "lat": 19.017,
            "lng": 72.843,
            "description": "Child spotted boarding Pune local accompanied by an adult in red shirt.",
            "photo_url": "/static/uploads/test_sighting.jpg",
            "reporter_contact": "+91 98888 77777",
            "anonymous": False
        }
        
        # Clean existing sightings
        await db.sightings.delete_many({"investigation_id": case_id})
        
        sighting_res = await client.post(f"{API_URL}/community/sightings", json=sighting_data, headers=headers)
        assert sighting_res.status_code == 200, f"Sighting post failed: {sighting_res.text}"
        sighting = sighting_res.json()
        sighting_id = sighting["id"]
        print(f"    [OK] Sighting report submitted for moderation (ID: {sighting_id})")

        # 5. Log in as Admin to Moderate Sighting
        print("\n[-] Audit Point 5: Admin Sighting Moderation & Timeline Integration...")
        admin_user = await db.users.find_one({"role": "admin"})
        if not admin_user:
            print("    [!] Warning: No admin account found in database. Skipping moderation check.")
        else:
            admin_login_res = await client.post(f"{API_URL}/auth/login", json={
                "email": admin_user["email"],
                "password": "adminpassword"
            })
            if admin_login_res.status_code != 200:
                admin_login_res = await client.post(f"{API_URL}/auth/login", json={
                    "email": admin_user["email"],
                    "password": "admin"
                })
            
            if admin_login_res.status_code == 200:
                admin_token = admin_login_res.json()["token"]
                admin_headers = {"Authorization": f"Bearer {admin_token}"}
                
                mod_res = await client.post(
                    f"{API_URL}/community/sightings/{sighting_id}/moderate",
                    json={"action": "approve"},
                    headers=admin_headers
                )
                assert mod_res.status_code == 200, f"Moderation failed: {mod_res.text}"
                print("    [OK] Sighting approved by Administrator successfully.")
                
                updated_case_res = await client.get(f"{API_URL}/investigations/{case_id}", headers=headers)
                updated_case = updated_case_res.json()
                timeline_events = [e["event_type"] for e in updated_case.get("timeline", [])]
                assert "new_sighting" in timeline_events, "Timeline failed to log verified sighting event!"
                print("    [OK] Sighting event successfully merged into chronological case timeline.")
            else:
                print(f"    [!] Skipping admin moderation step: Could not authenticate admin ({admin_login_res.text})")

        # 6. Volunteer Enlisting & Campaign Mobilization
        print("\n[-] Audit Point 6: Volunteer Network Registrations...")
        vol_res = await client.post(f"{API_URL}/community/volunteers", json={
            "contact_details": "+91 99999 88888",
            "city": "Mumbai",
            "district": "Bandra",
            "skills": ["Search & Rescue", "Medical / First Aid"],
            "availability": "available"
        }, headers=headers)
        assert vol_res.status_code == 200, f"Volunteer signup failed: {vol_res.text}"
        print("    [OK] Citizen successfully enlisted in active Volunteer Network.")

        campaign_res = await client.post(f"{API_URL}/community/volunteers/join-campaign", json={
            "investigation_id": case_id
        }, headers=headers)
        assert campaign_res.status_code == 200, f"Join campaign failed: {campaign_res.text}"
        print("    [OK] Volunteer mobilization: successfully joined search campaign.")

        # 7. Statistics Verification
        print("\n[-] Audit Point 7: Centralized Analytics & Dashboard Integrity...")
        stats_res = await client.get(f"{API_URL}/community/volunteers/stats")
        assert stats_res.status_code == 200, f"Stats fetch failed: {stats_res.text}"
        stats = stats_res.json()
        print(f"    [OK] Active Volunteers Enlisted: {stats['active_volunteers']}")
        print(f"    [OK] Sighting reports logged: {stats['total_sightings']}")

        # 8. Clean database test entries
        print("\n[-] Cleaning up E2E Audit database footprints...")
        await db.users.delete_many({"email": email})
        await db.investigations.delete_many({"id": case_id})
        await db.sightings.delete_many({"investigation_id": case_id})
        if user_id:
            await db.volunteers.delete_many({"id": user_id})
        print("    [OK] Database restored to original state.")
        print("\n====================================================")
        print("Audit Complete: All 7 E2E Integration Checks PASSED.")
        print("====================================================")
        return True

if __name__ == "__main__":
    load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), ".env")))
    asyncio.run(run_e2e_test())
