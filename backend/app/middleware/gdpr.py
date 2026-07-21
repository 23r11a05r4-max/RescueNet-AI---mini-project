from fastapi import Request, HTTPException

async def verify_gdpr_consent(request: Request):
    """
    FastAPI security dependency to verify that any personal data ingestion (registration, 
    missing child report submissions) includes explicit GDPR data processing consent.
    """
    if request.method in ("POST", "PATCH", "PUT"):
        try:
            # Safely check json body parameters for GDPR consent tokens
            body = await request.json()
            if not body:
                return
                
            # If payload contains personal data check for consent parameter
            has_personal_data = any(k in body for k in ("person_name", "email", "reporter_contact", "description"))
            if has_personal_data:
                if not body.get("gdpr_consent"):
                    raise HTTPException(
                        status_code=451, # Unavailable For Legal Reasons
                        detail="GDPR Compliance Notice: Personal data cannot be processed without explicit gdpr_consent: true."
                    )
        except HTTPException as he:
            raise he
        except Exception:
            # Let non-json requests pass (e.g. multipart/form-data upload checks are validated in their routers)
            pass
