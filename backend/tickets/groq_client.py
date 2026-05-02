import os
import json
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def analyze_ticket_with_groq(title, description):
    prompt = f"Return JSON only. No markdown. Ticket: {title} - {description}. Keys: category, priority, sentiment, needs_escalation, summary, suggested_response"
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=300
    )
    
    content = response.choices[0].message.content
    print("RAW:", repr(content))
    
    content = re.sub(r'```json\s*', '', content)
    content = re.sub(r'```\s*', '', content)
    content = content.strip()
    
    print("CLEAN:", repr(content))
    
    return json.loads(content)