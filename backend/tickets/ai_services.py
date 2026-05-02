from .groq_client import analyze_ticket_with_groq

def classify_ticket(title, description):
    """Analyze ticket using Groq AI"""
    try:
        result = analyze_ticket_with_groq(title, description)
        return result
    except Exception as e:
        print(f"Groq AI error: {e}")
        return {
            "category": "general",
            "priority": "medium",
            "sentiment": "neutral",
            "needs_escalation": False,
            "summary": title,
            "suggested_response": "Thank you for contacting us. We'll look into this."
        }

def generate_canned_response(ticket_title, customer_message):
    """Generate a personalized canned response using Groq"""
    try:
        result = analyze_ticket_with_groq(ticket_title, customer_message)
        return result.get("suggested_response", "Thank you for your message. Our team will review and respond shortly.")
    except Exception as e:
        print(f"Groq AI error: {e}")
        return f"Thank you for your message about '{ticket_title}'. Our team is reviewing your request."

def check_ai_health():
    """Check if AI service is working"""
    try:
        test = analyze_ticket_with_groq("Test", "This is a test")
        return {"status": "healthy", "message": "Groq AI is working"}
    except Exception as e:
        return {"status": "error", "message": str(e)}