# import re
# from django.core.mail import send_mail
# from django.conf import settings
# from django.utils import timezone
# from .models import Ticket, Conversation, UserProfile

# def send_ticket_confirmation(ticket):
#     """Send confirmation email when ticket is created"""
    
#     subject = f"Ticket #{ticket.id} Received - College Helpdesk"
    
#     message = f"""
# Dear {ticket.raised_by.user.get_full_name() or ticket.raised_by.user.username},

# Thank you for contacting the College Helpdesk. Your ticket has been created successfully.

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TICKET DETAILS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Ticket ID: #{ticket.id}
# Subject: {ticket.title}
# Category: {ticket.category.display_name}
# Status: {ticket.status}
# Created: {ticket.created_at.strftime('%B %d, %Y at %I:%M %p')}

# Your Message:
# {ticket.description}
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# IMPORTANT: To reply to this ticket, simply REPLY to this email. Your reply will be automatically added to the ticket.

# We will respond within 24 hours.

# Thanks,
# College Helpdesk Support Team
#     """
    
#     from_email = settings.DEFAULT_FROM_EMAIL
#     recipient_list = [ticket.raised_by.user.email]
    
#     send_mail(
#         subject,
#         message,
#         from_email,
#         recipient_list,
#         fail_silently=False,
#     )
    
#     print(f"📧 Confirmation email sent for ticket #{ticket.id} to {ticket.raised_by.user.email}")

# def send_reply_notification(ticket, conversation):
#     """Send email notification when agent replies to ticket"""
    
#     subject = f"Re: Ticket #{ticket.id} - College Helpdesk"
    
#     message = f"""
# Dear {ticket.raised_by.user.get_full_name() or ticket.raised_by.user.username},

# An agent has responded to your ticket.

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TICKET #{ticket.id}: {ticket.title}
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# AGENT RESPONSE:
# {conversation.message}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# To continue this conversation, simply REPLY to this email.

# Thanks,
# College Helpdesk Support Team
#     """
    
#     from_email = settings.DEFAULT_FROM_EMAIL
#     recipient_list = [ticket.raised_by.user.email]
    
#     send_mail(
#         subject,
#         message,
#         from_email,
#         recipient_list,
#         fail_silently=False,
#     )
    
#     print(f"📧 Reply notification sent for ticket #{ticket.id} to {ticket.raised_by.user.email}")

# def parse_incoming_email(email_subject, email_body, from_email):
#     """
#     Process incoming email replies
#     Returns: (ticket, conversation) if successful, (None, None) if not
#     """
    
#     # Step 1: Extract ticket ID from subject
#     match = re.search(r'Ticket #(\d+)', email_subject)
    
#     if not match:
#         print(f"❌ Could not find ticket ID in subject: {email_subject}")
#         return None, None
    
#     ticket_id = match.group(1)
    
#     # Step 2: Find the ticket
#     try:
#         ticket = Ticket.objects.get(id=ticket_id)
#     except Ticket.DoesNotExist:
#         print(f"❌ Ticket #{ticket_id} not found")
#         return None, None
    
#     # Step 3: Verify sender is the user who raised the ticket
#     if from_email != ticket.raised_by.user.email:
#         print(f"❌ Email from {from_email} does not match ticket user {ticket.raised_by.user.email}")
#         return None, None
    
#     # Step 4: Create conversation from email
#     conversation = Conversation.objects.create(
#         ticket=ticket,
#         sender_type='user',
#         message=email_body.strip(),
#         is_internal_note=False
#     )
    
#     print(f"📨 Incoming email processed: Ticket #{ticket.id} - New conversation #{conversation.id}")
    
#     return ticket, conversation
























import re
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from .models import Ticket, Conversation, UserProfile

def send_ticket_confirmation(ticket):
    """Send confirmation email when ticket is created"""
    
    subject = f"Ticket #{ticket.id} Received - ABC Institution Helpdesk"
    
    # Get user name
    if ticket.raised_by and ticket.raised_by.user:
        user_name = ticket.raised_by.user.get_full_name() or ticket.raised_by.user.username
    else:
        user_name = "Valued User"
    
    message = f"""
Dear {user_name},

Thank you for contacting ABC Institution Helpdesk. Your ticket has been created successfully.

Ticket ID: #{ticket.id}
Subject: {ticket.title}
Category: {ticket.category.display_name}
Status: {ticket.status}
Created: {ticket.created_at.strftime('%B %d, %Y at %I:%M %p')}

Your Message:
{ticket.description}

To reply to this ticket, simply reply to this email. Your reply will be automatically added to the ticket.

Our team will respond within 24 hours.

Thank you,
ABC Institution Helpdesk Support Team
"""
    
    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [ticket.raised_by.user.email]
    
    send_mail(
        subject,
        message,
        from_email,
        recipient_list,
        fail_silently=False,
    )
    
    print(f"📧 Confirmation email sent for ticket #{ticket.id} to {ticket.raised_by.user.email}")

def send_reply_notification(ticket, conversation):
    """Send email notification when agent replies to ticket"""
    
    subject = f"Re: Ticket #{ticket.id} - ABC Institution Helpdesk"
    
    # Get user name
    if ticket.raised_by and ticket.raised_by.user:
        user_name = ticket.raised_by.user.get_full_name() or ticket.raised_by.user.username
    else:
        user_name = "Valued User"
    
    message = f"""
Dear {user_name},

An agent has responded to your ticket.

Ticket #{ticket.id}: {ticket.title}

Agent Response:
{conversation.message}

To continue this conversation, simply reply to this email.

Thank you,
ABC Institution Helpdesk Support Team
"""
    
    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [ticket.raised_by.user.email]
    
    send_mail(
        subject,
        message,
        from_email,
        recipient_list,
        fail_silently=False,
    )
    
    print(f"📧 Reply notification sent for ticket #{ticket.id} to {ticket.raised_by.user.email}")

def parse_incoming_email(email_subject, email_body, from_email):
    """Process incoming email replies"""
    
    # Extract ticket ID from subject
    match = re.search(r'Ticket #(\d+)', email_subject)
    
    if not match:
        print(f"❌ Could not find ticket ID in subject: {email_subject}")
        return None, None
    
    ticket_id = match.group(1)
    
    try:
        ticket = Ticket.objects.get(id=ticket_id)
    except Ticket.DoesNotExist:
        print(f"❌ Ticket #{ticket_id} not found")
        return None, None
    
    if from_email != ticket.raised_by.user.email:
        print(f"❌ Email from {from_email} does not match ticket user {ticket.raised_by.user.email}")
        return None, None
    
    conversation = Conversation.objects.create(
        ticket=ticket,
        sender_type='user',
        message=email_body.strip(),
        is_internal_note=False
    )
    
    print(f"📨 Incoming email processed: Ticket #{ticket.id} - New conversation #{conversation.id}")
    
    return ticket, conversation