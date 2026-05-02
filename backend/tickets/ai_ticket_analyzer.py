# backend/tickets/ai_ticket_analyzer.py
import json
from .groq_client import analyze_ticket_with_groq

def enrich_ticket_with_ai(ticket):
    """Analyze ticket content and add AI suggestions"""
    
    # 1. Call Groq API
    ai_response = analyze_ticket_with_groq(ticket.title, ticket.description)
    
    # 2. Parse JSON response
    try:
        analysis = json.loads(ai_response)
    except json.JSONDecodeError:
        print(f"⚠️ AI response not valid JSON for ticket #{ticket.id}")
        return None
    
    # 3. Apply suggestions (does not overwrite existing values)
    if analysis.get('priority') and not ticket.priority:
        ticket.priority = analysis['priority']
    
    if analysis.get('order_number'):
        # Store extracted order number in a note (visible to agent)
        from .models import Conversation
        Conversation.objects.create(
            ticket=ticket,
            sender_type='agent',
            message=f"[AI DETECTED] Order number: {analysis['order_number']}",
            is_internal_note=True
        )
    
    ticket.save()
    return analysis