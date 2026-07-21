# -*- coding: utf-8 -*-
import uuid
import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.database import db
from app.middleware.auth import get_current_user
from app.config import EMERGENT_LLM_KEY
from app.utils.date import now_iso
from app.services.ai_service import LocalSemanticSearch

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

# Role system instructions
SYSTEM_PROMPTS = {
    "citizen": "You are a warm, supportive Missing Child Assistant for citizens. Guide them through reporting and safety SOPs.",
    "police": "You are a tactical Police Investigator AI Assistant. Suggest crime search methods, tracking steps, and evidence analysis.",
    "ngo": "You are a child rescue and rehabilitation AI Planner. Formulate shelter schedules, trauma counseling, and family reunion steps.",
    "admin": "You are a senior system administrator AI Assistant. Explain dashboard statistics, audit compliance, and system health status."
}

class ChatPayload(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: Optional[str] = "en"

# Multilingual response templates for all 5 languages
RESPONSES_MULTILINGUAL = {
    "en": {
        "panic": "Please stay calm. The emergency rescue teams and local child protection NGOs have been alerted. We are actively tracking recent case logs to assist you.",
        "report": "To report a missing child, go to the 'Investigations' page, select 'Report Missing Child', fill in the child's details, and upload last seen photos or CCTV files.",
        "docs": "Required documents include Aadhaar cards of the reporter, the child's birth certificate, and high-resolution photos or last-seen files.",
        "ngo": "NGO coordinators are preparing transition housing, medical care, and family reunion procedures.",
        "police": "You can reach out to the central police command at central-station@sentinel.gov or activate the emergency hotline call.",
        "default": "I am here to guide you. Under your role as {role}, I can analyze case files, search indexed manuals, or provide safety protocols for your query: '{query}'."
    },
    "te": {
        "panic": "ದಯವಿಟ್ಟು ಆತಂಕಪಡಬೇಡಿ. ರಕ್ಷಣಾ ತಂಡಗಳು ಮತ್ತು ಸ್ವಯಂಸೇವಾ ಸಂಸ್ಥೆಗಳು ಎಚ್ಚರಗೊಂಡಿವೆ. ನಾವು ಪ್ರಕರಣದ ವಿವರಗಳನ್ನು ನಿರಂತರವಾಗಿ ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇವೆ.", 
        "report": "తప్పిపోయిన పిల్లల సమాచారాన్ని నమోదు చేయడానికి, 'Investigations' విభాగానికి వెళ్లి, అక్కడ అడిగిన వివరాలను పూరించి, ఫోటోలు లేదా సీసీటీవీ ఫైళ్లను అప్‌లోడ్ చేయండి.",
        "docs": "అవసరమైన పత్రాలలో రిపోర్టర్ ఆధార్ కార్డు, పిల్లల జనన ధృవీకరణ పత్రం మరియు చివరిగా చూసిన ఫోటోలు ఉంటాయి.",
        "ngo": "స్వచ్ఛంద సంస్థల సమన్వయకర్తలు ఆశ్రయం, వైద్య సంరక్షణ మరియు కుటుంబ పునఃకలయిక ప్రక్రియలను సిద్ధం చేస్తున్నారు.",
        "police": "మీరు పోలీస్ కమాండ్ విభాగం central-station@sentinel.gov ని సంప్రదించవచ్చు లేదా అత్యవసర హాట్‌లైన్‌ను ప్రారంభించవచ్చు.",
        "default": "నేను మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను. మీ పాత్ర {role} కింద, మీ ప్రశ్న '{query}' కు సంబంధించి భద్రతా ప్రోటోకాల్స్ మరియు రికార్డులను నేను పరిశీలిస్తున్నాను."
    },
    "hi": {
        "panic": "कृपया शांत रहें। आपातकालीन बचाव दल और स्थानीय बाल संरक्षण गैर-सरकारी संगठनों को सतर्क कर दिया गया है। हम मामले की बारीकी से निगरानी कर रहे हैं।",
        "report": "लापता बच्चे की रिपोर्ट करने के लिए, 'Investigations' अनुभाग में जाएं, विवरण भरें और नवीनतम तस्वीरें या सीसीटीवी फुटेज अपलोड करें।",
        "docs": "आवश्यक दस्तावेजों में रिपोर्टर का आधार कार्ड, बच्चे का जन्म प्रमाण पत्र और आखिरी बार देखी गई तस्वीरें शामिल हैं।",
        "ngo": "एनजीओ कार्यकर्ता बच्चों के लिए आश्रय, परामर्श और पुनर्वास प्रक्रियाओं की व्यवस्था कर रहे हैं।",
        "police": "आप केंद्रीय पुलिस कमांड से central-station@sentinel.gov पर संपर्क कर सकते हैं या आपातकालीन हॉटलाइन सेवा शुरू कर सकते हैं।",
        "default": "मैं आपकी सहायता के लिए तैयार हूँ। आपकी भूमिका {role} के तहत, आपके प्रश्न '{query}' के संदर्भ में सुरक्षा पाना और नियमों की जांच की जा रही है।"
    },
    "ta": {
        "panic": "தயவுசெய்து அமைதியாக இருங்கள். அவசர மீட்புக் குழுக்களும் தன்னார்வத் தொண்டு நிறுவனங்களும் எச்சரிக்கப்பட்டுள்ளன. நாங்கள் வழக்கை தீவிரமாகக் கண்காணித்து வருகிறோம்.",
        "report": "காணாமல் போன குழந்தையைப் புகாரளிக்க, 'Investigations' பக்கத்திற்குச் சென்று, விவரங்களை நிரப்பி, புகைப்படங்கள் அல்லது சிசிடிவி கோப்புகளைப் பதிவேற்றவும்.",
        "docs": "தேவையான ஆவணங்களில் புகாரளிப்பவரின் ஆதார் அட்டை, குழந்தையின் பிறப்புச் சான்றிதழ் மற்றும் புகைப்படங்கள் ஆகியவை அடங்கும்.",
        "ngo": "தன்னார்வத் தொண்டு நிறுவனங்கள் தங்குமிடம், மருத்துவ உதவி மற்றும் குடும்ப மறுசேர்க்கைக்கான பணிகளை மேற்கொண்டு வருகின்றன.",
        "police": "நீங்கள் காவல் கட்டுப்பாட்டு அறையை central-station@sentinel.gov மூலம் தொடர்பு கொள்ளலாம் அல்லது அவசர அழைப்பை மேற்கொள்ளலாம்.",
        "default": "நான் உங்களுக்கு உதவ தயாராக உள்ளேன். உங்கள் பங்கு {role} இன் கீழ், உங்கள் கேள்வி '{query}' தொடர்பாக பாதுகாப்பு நெறிமுறைகளை நான் சரிபார்த்து வருகிறேன்."
    },
    "kn": {
        "panic": "ದಯವಿಟ್ಟು ಶಾಂತರಾಗಿರಿ. ತುರ್ತು ರಕ್ಷಣಾ ತಂಡಗಳು ಮತ್ತು ಸ್ಥಳೀಯ ಸ್ವಯಂಸೇವಾ ಸಂಸ್ಥೆಗಳನ್ನು ಎಚ್ಚರಿಸಲಾಗಿದೆ. ನಾವು ಪ್ರಕರಣದ ವಿವರಗಳನ್ನು ನಿಕಟವಾಗಿ ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇವೆ.",
        "report": "ಕಾಣೆಯಾದ ಮಗುವಿನ ವರದಿಯನ್ನು ಸಲ್ಲಿಸಲು, 'Investigations' ಪುಟಕ್ಕೆ ಹೋಗಿ, ಮಗುವಿನ ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ ಮತ್ತು ಇತ್ತೀಚಿನ ಫೋಟೋಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
        "docs": "ಅಗತ್ಯವಿರುವ ದಾಖಲೆಗಳಲ್ಲಿ ವರದಿಗಾರರ ಆಧಾರ್ ಕಾರ್ಡ್, ಮಗುವಿನ ಜನ್ಮ ಪ್ರಮಾಣಪತ್ರ ಮತ್ತು ಇತ್ತೀಚಿನ ಫೋಟೋಗಳು ಸೇರಿವೆ.",
        "ngo": "ಸ್ವಯಂಸೇವಾ ಸಂಸ್ಥೆಗಳು ಮಗುವಿಗೆ ವಸತಿ, ವೈದ್ಯಕೀಯ ಆರೈಕೆ ಮತ್ತು ಪುನರ್ವಸತಿ ಕಾರ್ಯಗಳನ್ನು ವ್ಯವಸ್ಥೆಗೊಳಿಸುತ್ತಿವೆ.",
        "police": "ನೀವು ಪೊಲೀಸ್ ಕಮಾಂಡ್ ಕೇಂದ್ರವನ್ನು central-station@sentinel.gov ಮೂಲಕ ಸಂಪರ್ಕಿಸಬಹುದು ಅಥವಾ ತುರ್ತು ಸಹಾಯವಾಣಿಯನ್ನು ಬಳಸಬಹುದು.",
        "default": "ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ. ನಿಮ್ಮ ಪಾತ್ರ {role} ಅಡಿಯಲ್ಲಿ, ನಿಮ್ಮ ಪ್ರಶ್ನೆ '{query}' ಗೆ ಸಂಬಂಧಿಸಿದಂತೆ ಸುರಕ್ಷತಾ ನಿಯಮಗಳು ಮತ್ತು ದಾಖಲೆಗಳನ್ನು ನಾನು ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇನೆ."
    }
}

# Resolve translation fallback for Telugu panic template line mismatch
RESPONSES_MULTILINGUAL["te"]["panic"] = "దయచేసి ఆందోళన చెందకండి. సహాయక బృందాలు మరియు స్వచ్ఛంద సంస్థలు అప్రమತ್ತమయ్యాయి. కేసు వివరాలను మేము నిరంతరం పర్యवेక్షిస్తున్నాము."

def generate_mock_dynamic_reply(user_msg: str, lang_key: str, role: str) -> str:
    clean_msg = user_msg.strip("?.").strip()
    msg_lower = clean_msg.lower()
    
    lang = lang_key.lower() if lang_key in RESPONSES_MULTILINGUAL else "en"
    templates = RESPONSES_MULTILINGUAL[lang]
    
    # Context matching
    if any(w in msg_lower for w in ["panic", "help", "scared", "fear", "खतरा", "बचाओ", "భయం", "కాపాడండి", "அச்சம்", "காப்பாற்று", "ಭಯ", "ಕಾಪಾಡಿ"]):
        return templates["panic"]
    elif any(w in msg_lower for w in ["missing child", "report", "लापता", "रिपोर्ट", "తప్పిపోయిన", "నివేద", "காணவில்லை", "புகார்", "ಕಾಣೆಯಾದ", "ವರದಿ"]):
        return templates["report"]
    elif any(w in msg_lower for w in ["document", "doc", "दस्तावेज", "పత్ర", "ஆவணம்", "ದಾಖಲೆ"]):
        return templates["docs"]
    elif any(w in msg_lower for w in ["ngo", "shelter", "support", "एनजीओ", "ಸ್వచ్ఛంద", "தன்னார்வ", "ಸಹಾಯ"]):
        return templates["ngo"]
    elif any(w in msg_lower for w in ["police", "station", "पुलिस", "పోలీస్", "காவல்", "ಪೊಲೀಸ್"]):
        return templates["police"]
    else:
        return templates["default"].format(role=role, query=clean_msg)

TRANSLATED_RESPONSES = {
    "en": {
        "active_cases": "There are currently {count} active cases in the system.",
        "open_cases": "There are currently {count} open cases awaiting initial investigation.",
        "recovered_cases": "A total of {count} children have been successfully recovered.",
        "closed_cases": "There are {count} closed cases.",
        "total_cases": "There are a total of {count} registered cases in the database.",
        "critical_cases": "There are {count} cases marked with Critical priority.",
        "high_cases": "There are {count} cases marked with High priority.",
        "child_found": "Case File found for {name}: Age {age}, last seen at {location}. Current status: {status}, priority: {priority}.",
        "child_not_found": "I could not find any active case file matching the name '{name}'.",
        "no_data": "I was unable to retrieve that specific statistic from the command logs.",
    },
    "te": {
        "active_cases": "వ్యవస్థలో ప్రస్తుతం {count} క్రియాశీల (active) కేసులు ఉన్నాయి.",
        "open_cases": "ప్రస్తుతం శోధనలో ఉన్న ఓపెన్ కేసులు {count}.",
        "recovered_cases": "మొత్తం {count} మంది పిల్లలు విజయవంతంగా సురక్షితంగా రక్షించబడ్డారు.",
        "closed_cases": "పరిష్కరించబడిన మూసివేసిన కేసులు {count}.",
        "total_cases": "డేటాబేస్లో మొత్తం {count} కేసులు నమోదయ్యాయి.",
        "critical_cases": "తీవ్రమైన (Critical) ప్రాధాన్యత కలిగిన కేసులు {count} ఉన్నాయి.",
        "high_cases": "అధిక (High) ప్రాధాన్యత కలిగిన కేసులు {count} ఉన్నాయి.",
        "child_found": "{name} యొక్క కేసు రికార్డు కనుగొనబడింది: వయస్సు {age}, చివరిసారి చూసిన స్థలం {location}. ప్రస్తుత స్థితి: {status}, ప్రాధాన్యత: {priority}.",
        "child_not_found": "'{name}' పేరుతో తప్పిపోయిన కేసు వివరాలు ఏవీ కనుగొనబడలేదు.",
        "no_data": "కమాండ్ లాగ్ల నుండి ఆ సమాచారాన్ని సేకరించడం సాధ్యపడలేదు.",
    },
    "hi": {
        "active_cases": "सिस्टम में वर्तमान में {count} सक्रिय (active) मामले हैं।",
        "open_cases": "वर्तमान में {count} खुले (open) मामले हैं जिन पर कार्रवाई जारी है।",
        "recovered_cases": "कुल {count} बच्चों को सफलतापूर्वक सुरक्षित बरामद कर लिया गया है।",
        "closed_cases": "बंद किए गए मामलों की संख्या {count} है।",
        "total_cases": "डेटाबेस में कुल {count} मामले पंजीकृत हैं।",
        "critical_cases": "{count} मामले अति-संवेदनशील (Critical) श्रेणी में हैं।",
        "high_cases": "{count} मामले उच्च (High) प्राथमिकता श्रेणी में हैं।",
        "child_found": "{name} की केस फ़ाइल मिल गई है: उम्र {age}, आखिरी बार {location} में देखा गया। वर्तमान स्थिति: {status}, प्राथमिकता: {priority}।",
        "child_not_found": "मुझे '{name}' नाम से मेल खाता हुआ कोई केस रिकॉर्ड नहीं मिला।",
        "no_data": "मैं कमांड लॉग से वह विशिष्ट आंकड़े प्राप्त करने में असमर्थ रहा।",
    },
    "ta": {
        "active_cases": "கணினியில் தற்போது {count} செயலில் உள்ள (active) வழக்குகள் உள்ளன.",
        "open_cases": "தற்போது {count} திறந்த (open) வழக்குகள் விசாரணையில் உள்ளன.",
        "recovered_cases": "மொத்தம் {count} குழந்தைகள் வெற்றிகரமாக மீட்கப்பட்டுள்ளனர்.",
        "closed_cases": "மூடப்பட்ட வழக்குகள் {count} ஆகும்.",
        "total_cases": "தரவுத்தளத்தில் மொத்தம் {count} வழக்குகள் பதிவாகியுள்ளன.",
        "critical_cases": "மிக முக்கியமான (Critical) முன்னுரிமை கொண்ட வழக்குகள் {count} உள்ளன.",
        "high_cases": "உயர்ந்த (High) முன்னுரிமை கொண்ட வழக்குகள் {count} உள்ளன.",
        "child_found": "{name} இன் வழக்கு கோப்பு கண்டறியப்பட்டது: வயது {age}, கடைசியாக பார்த்த இடம் {location}. தற்போதைய நிலை: {status}, முன்னுரிமை: {priority}.",
        "child_not_found": "'{name}' என்ற பெயரில் எந்தவொரு வழக்கு பதிவும் கண்டறியப்படவில்லை.",
        "no_data": "கட்டளை பதிவுகளிலிருந்து அந்த குறிப்பிட்ட தகவலைப் பெற முடியவில்லை.",
    },
    "kn": {
        "active_cases": "ವ್ಯವಸ್ಥೆಯಲ್ಲಿ ಪ್ರಸ್ತುತ {count} ಸಕ್ರಿಯ (active) ಪ್ರಕರಣಗಳಿವೆ.",
        "open_cases": "ಪ್ರಸ್ತುತ {count} ಮುಕ್ತ (open) ಪ್ರಕರಣಗಳು ತನಿಖೆಯಲ್ಲವೆ.",
        "recovered_cases": "ಒಟ್ಟು {count} ಮಕ್ಕಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ರಕ್ಷಿಸಲಾಗಿದೆ.",
        "closed_cases": "ಮುಚ್ಚಲಾದ ಪ್ರಕರಣಗಳು {count} ಇವೆ.",
        "total_cases": "ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಒಟ್ಟು {count} ಪ್ರಕರಣಗಳು ದಾಖಲಾಗಿವೆ.",
        "critical_cases": "ಅತಿ ಮುಖ್ಯ (Critical) ಆದ್ಯತೆಯ ಪ್ರಕರಣಗಳು {count} ಇವೆ.",
        "high_cases": "ಹೆಚ್ಚಿನ (High) ಆದ್ಯತೆಯ ಪ್ರಕರಣಗಳು {count} ಇವೆ.",
        "child_found": "{name} ಅವರ ಪ್ರಕರಣದ ಕಡತ ಪತ್ತೆಯಾಗಿದೆ: ವಯಸ್ಸು {age}, ಕೊನೆಯ ಬಾರಿ ಕಂಡ ಸ್ಥಳ {location}. ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ: {status}, ಆದ್ಯತೆ: {priority}.",
        "child_not_found": "'{name}' ಹೆಸರಿನ ಯಾವುದೇ ಪ್ರಕರಣದ ದಾಖಲೆಗಳು ಪತ್ತೆಯಾಗಿಲ್ಲ.",
        "no_data": "ವರದಿಗಳಿಂದ ಆ ನಿರ್ದಿಷ್ಟ ಮಾಹಿತಿಯನ್ನು ಪಡೆಯಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ.",
    }
}

RAG_TRANSLATIONS = {
    "Police_SOP_Missing_Children.pdf": {
        "en": "Standard Operating Procedure (SOP) for Police: Upon receiving a report, file an FIR, assign an officer, register tracking details, and alert local patrols. Priority is escalated to Critical/High for children under 12.",
        "te": "పోలీస్ ప్రామాణిక నిబంధనల ప్రకారం (SOP): తప్పిపోయిన పిల్లల నివేదిక వచ్చిన వెంటనే FIR నమోదు చేయాలి, దర్యాప్తు అధికారిని నియమించాలి మరియు స్థానిక గస్తీ బృందాలను అప్రమత్తం చేయాలి. 12 సంవత్సరాల లోపు పిల్లల కేసులకు అత్యవసర ప్రాధాన్యత ఇవ్వబడుతుంది.",
        "hi": "पुलिस मानक संचालन प्रक्रिया (SOP) के अनुसार: रिपोर्ट मिलने पर तुरंत FIR दर्ज करें, जांच अधिकारी नियुक्त करें और स्थानीय गश्ती दलों को सतर्क करें। 12 वर्ष से कम उम्र के बच्चों के मामलों को उच्च प्राथमिकता दी जाती है।",
        "ta": "காவல்துறை நிலையான நடைமுறையின்படி (SOP): புகார் வந்தவுடன் FIR பதிவு செய்யவும், விசாரணை அதிகாரியை நியமிக்கவும் மற்றும் உள்ளூர் ரோந்துப் படையினரை எச்சரிக்கவும். 12 வயதுக்குட்பட்ட குழந்தைகளுக்கு முன்னுரிமை அளிக்கப்படுகிறது.",
        "kn": "ಪೊಲೀಸ್ ಪ್ರಮಾಣಿತ ಕಾರ್ಯಾಚರಣಾ ವಿಧಾನದ ಪ್ರಕಾರ (SOP): ವರದಿ ಬಂದ ತಕ್ಷಣ FIR ದಾಖಲಿಸಿ, ತನಿಖಾ ಅಧಿಕಾರಿಯನ್ನು ನೇಮಿಸಿ ಮತ್ತು ಗಸ್ತು ಸಿಬ್ಬಂದಿಯನ್ನು ಎಚ್ಚರಿಸಿ. 12 ವರ್ಷದೊಳಗಿನ ಮಕ್ಕಳಿಗೆ ಹೆಚ್ಚಿನ ಆದ್ಯತೆ ನೀಡಲಾಗುತ್ತದೆ."
    },
    "Citizen_Reporting_Guide.pdf": {
        "en": "Citizen Reporting Guide: Provide child's name, age, physical features, birth certificate, Aadhaar, and recent high-resolution photographs showing last seen clothing.",
        "te": "సిటిజన్ రిపోర్టింగ్ గైడ్: తప్పిపోయిన పిల్లల పేరు, వయస్సు, శారీరక గుర్తులు, ఆధార్ కార్డు మరియు చివరిసారిగా చూసినప్పుడు ధరించిన దుస్తుల వివరాలతో కూడిన ఫోటోలను సమర్పించాలి.",
        "hi": "नागरिक रिपोर्टिंग गाइड: बच्चे का नाम, उम्र, शारीरिक पहचान, आधार कार्ड और आखिरी बार देखी गई तस्वीरों की जानकारी हालिया कपड़ों के विवरण के साथ प्रदान करें।",
        "ta": "குடிமக்கள் புகாரளிக்கும் வழிகாட்டி: குழந்தையின் பெயர், வயது, அடையாளங்கள், ஆதார் அட்டை மற்றும் கடைசியாக பார்த்த புகைப்படங்களை வழங்கவும்.",
        "kn": "ನಾಗರಿಕರ ವರದಿ ಮಾರ್ಗದರ್ಶಿ: ಮಗುವಿನ ಹೆಸರು, ವಯಸ್ಸು, ಗುರುತುಗಳು, ಆಧಾರ್ ಕಾರ್ಡ್ ಮತ್ತು ಇತ್ತೀಚಿನ ಫೋಟೋಗಳನ್ನು ಒದಗಿಸಿ."
    },
    "NGO_Rehabilitation_Manual.pdf": {
        "en": "NGO Rehabilitation Manual: Rescued children receive child-friendly trauma counseling, temporary shelter housing, and medical exams. Verification is required before family reunion.",
        "te": "NGO పునరావాస నియమావళి: రక్షించబడిన పిల్లలకు వైద్య పరీక్షలు, కౌన్సిలింగ్ మరియు తాత్కాలిక వసతి కల్పిస్తారు. కుటుంబ పునఃకలయికకు ముందు ధృవీకరణ తప్పనిసరి.",
        "hi": "एनजीओ पुनर्वास नियमावली: बचाए गए बच्चों को चिकित्सा जांच, परामर्श और अस्थायी आश्रय प्रदान किया जाता है। परिवार से मिलाने से पहले दस्तावेजों का सत्यापन आवश्यक है।",
        "ta": "தன்னார்வ தொண்டு நிறுவன மறுவாழ்வு கையேடு: மீட்கப்பட்ட குழந்தைகளுக்கு மருத்துவ பரிசோதனை, ஆலோசனை மற்றும் தற்காலிக தங்குமிடம் வழங்கப்படுகிறது.",
        "kn": "ಸ್ವಯಂಸೇವಾ ಸಂಸ್ಥೆ ಪುನರ್ವಸತಿ ಕೈಪಿಡಿ: ರಕ್ಷಿಸಲ್ಪಟ್ಟ ಮಕ್ಕಳಿಗೆ ವೈದ್ಯಕೀಯ ತಪಾಸಣೆ, ಆಪ್ತಸಮಾಲೋಚನೆ ಮತ್ತು ತಾತ್ಕಾಲಿಕ ವಸತಿ ಕಲ್ಪಿಸಲಾಗುತ್ತದೆ."
    },
    "SOP_Telephony_Hotline.pdf": {
        "en": "Telephony SOP: Citizens calls are routed to local stations. Audio is transcribed, sentiment is assessed, and active calls are logged.",
        "te": "టెలిఫోనీ SOP: పౌరుల కాల్స్ స్థానిక పోలీస్ స్టేషన్లకు అనుసంధానించబడతాయి. ఆడియో ట్రాన్స్క్రిప్ట్ చేయబడుతుంది మరియు సంభాషణ లాగ్ రికార్డ్ చేయబడుతుంది.",
        "hi": "टेलीफोनी SOP: नागरिकों के कॉल को स्थानीय थानों में भेजा जाता है। ऑडियो को ट्रांसक्राइब किया जाता है और कॉल लॉग्स को सहेज कर रखा जाता है।",
        "ta": "தொலைபேசி SOP: குடிமக்களின் அழைப்புகள் உள்ளூர் நிலையங்களுக்கு மாற்றப்படும். அழைப்பு பதிவுகள் சேமிக்கப்படும்.",
        "kn": "ದೂರವಾಣಿ SOP: ನಾಗರಿಕರ ಕರೆಗಳನ್ನು ಸ್ಥಳೀಯ ಠಾಣೆಗಳಿಗೆ ವರ್ಗಾಯಿಸಲಾಗುತ್ತದೆ. ಕರೆ ದಾಖಲೆಗಳನ್ನು ಸಂರಕ್ಷಿಸಲಾಗುತ್ತದೆ."
    }
}

async def query_live_database(user_msg: str, lang: str) -> Optional[str]:
    msg = user_msg.lower()
    
    # Check for specific child search
    matched_child = None
    try:
        all_children = await db.investigations.find({}, {"person_name": 1, "age": 1, "last_seen_location": 1, "status": 1, "priority": 1}).to_list(2000)
        for c in all_children:
            name = c.get("person_name", "")
            first_name = name.split()[0] if name else ""
            if (name and name.lower() in msg) or (first_name and len(first_name) > 2 and first_name.lower() in msg):
                matched_child = c
                break
    except Exception:
        pass
            
    if matched_child:
        key = "child_found"
        params = {
            "name": matched_child["person_name"],
            "age": matched_child["age"],
            "location": matched_child["last_seen_location"],
            "status": matched_child["status"].upper(),
            "priority": matched_child["priority"]
        }
        return TRANSLATED_RESPONSES[lang][key].format(**params)
        
    # Check counts query intent
    is_cases_query = any(w in msg for w in ["case", "report", "child", "children", "కేసు", "కేసులు", "పిల్లలు", "मामले", "मामला", "बच्चे", "வழக்கு", "வழக்குகள்", "குழந்தைகள்", "ಪ್ರಕರಣ", "ಮಕ್ಕಳು"])
    
    if is_cases_query:
        try:
            if any(w in msg for w in ["active", "సక్రియ", "క్రియాశీల", "सक्रिय", "செயலில்", "ಸಕ್ರಿಯ"]):
                count = await db.investigations.count_documents({"status": {"$in": ["open", "in_progress"]}})
                return TRANSLATED_RESPONSES[lang]["active_cases"].format(count=count)
            elif any(w in msg for w in ["open", "ఓపెన్", "खुले", "திறந்த", "ಮುಕ್ತ"]):
                count = await db.investigations.count_documents({"status": "open"})
                return TRANSLATED_RESPONSES[lang]["open_cases"].format(count=count)
            elif any(w in msg for w in ["recovered", "resolved", "found", "రక్షించ", "సురక్షిత", "బరామద", "మీட்கப்பட்ட", "ರಕ್ಷಿಸಿದ"]):
                count = await db.investigations.count_documents({"status": "recovered"})
                return TRANSLATED_RESPONSES[lang]["recovered_cases"].format(count=count)
            elif any(w in msg for w in ["closed", "మూసివేసిన", "बंद", "மூடப்பட்ட", "ಮುಚ್ಚಲಾದ"]):
                count = await db.investigations.count_documents({"status": "closed"})
                return TRANSLATED_RESPONSES[lang]["closed_cases"].format(count=count)
            elif any(w in msg for w in ["critical", "క్రుటికల్", "తీవ్రమైన", "गंभीर", "முக்கியமான", "ಅತಿ ಮುಖ್ಯ"]):
                count = await db.investigations.count_documents({"priority": "Critical"})
                return TRANSLATED_RESPONSES[lang]["critical_cases"].format(count=count)
            elif any(w in msg for w in ["high", "అధిక", "उच्च", "உயர்ந்த", "ಹೆಚ್ಚಿನ"]):
                count = await db.investigations.count_documents({"priority": "High"})
                return TRANSLATED_RESPONSES[lang]["high_cases"].format(count=count)
            elif any(w in msg for w in ["total", "మొత్తం", "कुल", "மொத்த", "ಒಟ್ಟು"]):
                count = await db.investigations.count_documents({})
                return TRANSLATED_RESPONSES[lang]["total_cases"].format(count=count)
        except Exception:
            pass
            
    return None

@router.post("")
async def create_chat_message(body: ChatPayload, user=Depends(get_current_user)):
    user_id = user["id"]
    role = user["role"]
    user_msg = body.message
    session_id = body.session_id or str(uuid.uuid4())
    
    # Auto-detect language of request
    lang = body.language or "en"
    if any(c for c in user_msg if '\u0900' <= c <= '\u097F'):
        lang = "hi"
    elif any(c for c in user_msg if '\u0c00' <= c <= '\u0c7f'):
        lang = "te"
    elif any(c for c in user_msg if '\u0b80' <= c <= '\u0bff'):
        lang = "ta"
    elif any(c for c in user_msg if '\u0c80' <= c <= '\u0cff'):
        lang = "kn"
        
    ai_reply = ""
    sources = []
    
    # 1. Live Database query matches
    db_reply = await query_live_database(user_msg, lang)
    if db_reply:
        ai_reply = db_reply

    # 2. RAG matching from knowledge chunks
    if not ai_reply:
        matches = []
        try:
            docs = await db.knowledge_chunks.find({}, {"_id": 0}).to_list(2000)
            if docs:
                matches = LocalSemanticSearch.find_matches(user_msg, docs, top_k=3)
                if matches and len(matches) > 0:
                    best_match = matches[0]
                    filename = best_match.get("filename", "")
                    text = best_match.get("text", "")
                    
                    # Citations list
                    for m in matches:
                        if m.get("filename") and m.get("filename") not in sources:
                            sources.append(m.get("filename"))
                            
                    # Retrieve localized translation of RAG manually
                    if filename in RAG_TRANSLATIONS and lang in RAG_TRANSLATIONS[filename]:
                        translated_text = RAG_TRANSLATIONS[filename][lang]
                    else:
                        translated_text = text
                        
                    if lang == "te":
                        ai_reply = f"{translated_text}\n\n(ఆధార పత్రం: {filename})"
                    elif lang == "hi":
                        ai_reply = f"{translated_text}\n\n(संदर्भ दस्तावेज: {filename})"
                    elif lang == "ta":
                        ai_reply = f"{translated_text}\n\n(சான்று ஆவணம்: {filename})"
                    elif lang == "kn":
                        ai_reply = f"{translated_text}\n\n(ಆಧಾರ ದಾಖಲೆ: {filename})"
                    else:
                        ai_reply = f"{translated_text}\n\n(Citation Source: {filename})"
        except Exception as e:
            logger.warning(f"RAG fetch failed: {e}")

    # Read previous message logs from MongoDB for conversation memory
    prev_messages = []
    try:
        session_doc = await db.chat_sessions.find_one({"session_id": session_id})
        if session_doc:
            prev_messages = session_doc.get("messages", [])
    except Exception:
        pass

    # 3. Fallback to LLM / Mock dynamic reply
    if not ai_reply:
        if LLM_AVAILABLE and EMERGENT_LLM_KEY:
            try:
                base_prompt = SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS["citizen"])
                language_instruction = f"\nRespond strictly in the language: {lang}."
                system_instruction = f"{base_prompt}\nAnswer the query concisely.{language_instruction}"
                
                chat_client = LlmChat(
                    api_key=EMERGENT_LLM_KEY,
                    session_id=f"session-{session_id}",
                    system_message=system_instruction
                ).with_model("anthropic", "claude-sonnet-4-5-20250929")
                
                resp = await chat_client.send_message(UserMessage(text=user_msg))
                ai_reply = str(resp)
            except Exception as e:
                logger.error(f"LLM Chat failed: {e}")
                
        if not ai_reply:
            if any(w in user_msg.lower() for w in ["what did i", "recall", "remember", "history", "name", "previous"]):
                past_user_queries = [m["content"] for m in prev_messages if m["role"] == "user" and len(m["content"]) < 60]
                if past_user_queries:
                    if lang == "te":
                        ai_reply = f"మీరు ఇంతకుముందు ఇలా అడిగారు: '{past_user_queries[-1]}'."
                    elif lang == "hi":
                        ai_reply = f"आपने पहले पूछा था: '{past_user_queries[-1]}'."
                    elif lang == "ta":
                        ai_reply = f"நீங்கள் முன்பு கேட்டது: '{past_user_queries[-1]}'."
                    elif lang == "kn":
                        ai_reply = f"ನೀವು ಹಿಂದೆ ಕೇಳಿದ್ದು: '{past_user_queries[-1]}'."
                    else:
                        ai_reply = f"You previously asked: '{past_user_queries[-1]}'."
                else:
                    if lang == "te":
                        ai_reply = "సరే, మీ మునుపటి సంభాషణ వివరాలను నేను పరిశీలిస్తున్నాను."
                    elif lang == "hi":
                        ai_reply = "ठीक है, मैं आपके पिछले संदेशों का इतिहास देख रहा हूँ।"
                    else:
                        ai_reply = "I am tracking our active session chat history logs."
            else:
                ai_reply = generate_mock_dynamic_reply(user_msg, lang, role)

    # 4. Save to MongoDB chat_sessions
    user_entry = {"role": "user", "content": user_msg, "timestamp": now_iso()}
    ai_entry = {
        "role": "assistant", 
        "content": ai_reply, 
        "sources": sources,
        "timestamp": now_iso()
    }
    
    await db.chat_sessions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "user_id": user_id,
                "role": role,
                "timestamp": now_iso()
            },
            "$push": {
                "messages": {"$each": [user_entry, ai_entry]}
            }
        },
        upsert=True
    )
    
    return {
        "session_id": session_id,
        "response": ai_reply,
        "role": role,
        "sources": sources
    }

@router.get("/history/{session_id}")
async def get_chat_history(session_id: str, user=Depends(get_current_user)):
    session = await db.chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session.get("user_id") != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return session.get("messages", [])

@router.get("/sessions")
async def get_user_chat_sessions(user=Depends(get_current_user)):
    sessions = await db.chat_sessions.find({"user_id": user["id"]}, {"_id": 0, "messages": 0}).sort("timestamp", -1).to_list(100)
    return sessions

class HandoffPayload(BaseModel):
    session_id: str
    target_role: str = "police" # police, ngo, admin

class HandoffReplyPayload(BaseModel):
    session_id: str
    message: str

@router.post("/handoff")
async def initiate_handoff(body: HandoffPayload, user=Depends(get_current_user)):
    """
    Flags an active chat session for human handoff transfer (e.g. Citizen -> Police -> NGO -> Admin).
    """
    session = await db.chat_sessions.find_one({"session_id": body.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    await db.chat_sessions.update_one(
        {"session_id": body.session_id},
        {
            "$set": {
                "status": "handed_off",
                "assigned_role": body.target_role,
                "handoff_requested_at": now_iso()
            }
        }
    )
    
    from app.services.notification_service import emit_alert
    await emit_alert(
        alert_type="human_handoff",
        title="Human Handoff Request",
        description=f"Citizen requested transfer to {body.target_role.upper()} for session {body.session_id[:8]}.",
        priority="High"
    )
    return {"ok": True, "status": "handed_off", "assigned_role": body.target_role}

@router.get("/handoff/active")
async def list_active_handoffs(user=Depends(get_current_user)):
    """
    Returns list of active chat sessions currently handed off to the user's role.
    """
    role = user["role"]
    query = {"status": "handed_off"}
    if role != "admin":
        query["assigned_role"] = role
        
    handoffs = await db.chat_sessions.find(query, {"_id": 0}).sort("handoff_requested_at", -1).to_list(100)
    return handoffs

@router.post("/handoff/reply")
async def handoff_human_reply(body: HandoffReplyPayload, user=Depends(get_current_user)):
    """
    Submits a human reply (Police/NGO/Admin) to a handed-off chat session, preserving history.
    """
    if user["role"] not in ["admin", "police", "ngo"]:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    session = await db.chat_sessions.find_one({"session_id": body.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    entry = {
        "role": "assistant",
        "content": body.message,
        "sender_name": user["name"],
        "sender_role": user["role"],
        "timestamp": now_iso()
    }
    
    await db.chat_sessions.update_one(
        {"session_id": body.session_id},
        {
            "$set": {
                "status": "replied",
                "timestamp": now_iso()
            },
            "$push": {
                "messages": entry
            }
        }
    )
    return {"ok": True}
