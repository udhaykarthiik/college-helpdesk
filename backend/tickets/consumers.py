import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from urllib.parse import parse_qs


class TicketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Called when WebSocket connects"""
        
        print("🔌 WebSocket connection attempt")
        
        # Get token from URL query string
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        print(f"🔑 Token present: {token is not None}")
        
        if not token:
            print("❌ No token, closing connection")
            await self.close()
            return
        
        # Get user from token
        user = await self.get_user_from_token(token)
        
        if not user:
            print("❌ Invalid token, closing connection")
            await self.close()
            return
        
        # Store user in scope
        self.scope['user'] = user
        
        # Get ticket ID from URL
        self.ticket_id = self.scope['url_route']['kwargs'].get('ticket_id')
        
        if not self.ticket_id:
            print("❌ No ticket ID, closing connection")
            await self.close()
            return
        
        # Create room group name
        self.room_group_name = f"ticket_{self.ticket_id}"
        
        # Check if user has access to this ticket
        has_access = await self.check_ticket_access(user, self.ticket_id)
        
        if not has_access:
            print(f"❌ User {user.username} does not have access to ticket {self.ticket_id}")
            await self.close()
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # Accept the WebSocket connection
        await self.accept()
        
        print(f"✅ WebSocket connected for ticket {self.ticket_id}, user: {user.username}")
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection',
            'status': 'connected',
            'ticket_id': self.ticket_id,
            'user': user.username
        }))
    
    async def disconnect(self, close_code):
        """Called when WebSocket disconnects"""
        print(f"🔌 WebSocket disconnected: {close_code}")
        
        if hasattr(self, 'room_group_name') and self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """Called when message is received from WebSocket"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'message')
            
            print(f"📨 Received message type: {message_type}")
            
            if message_type == 'message':
                await self.handle_chat_message(data)
            elif message_type == 'ping':
                await self.handle_ping()
                
        except json.JSONDecodeError:
            print("❌ Invalid JSON received")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Invalid JSON format'
            }))
    
    async def handle_chat_message(self, data):
        """Handle actual chat messages"""
        message = data.get('message', '')
        sender_type = data.get('sender_type', 'user')
        is_internal = data.get('is_internal_note', False)
        
        if not message or not message.strip():
            return
        
        user = self.scope['user']
        
        print(f"💬 New message from {sender_type}: {message[:50]}...")
        
        # Save message to database
        conversation = await self.save_message(
            self.ticket_id, 
            message.strip(), 
            sender_type,
            is_internal,
            user
        )
        
        if not conversation:
            print("❌ Failed to save message")
            return
        
        # Get sender name
        sender_name = await self.get_sender_name(user, sender_type)
        
        # Broadcast to room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message_id': conversation.id,
                'message': message.strip(),
                'sender_type': sender_type,
                'sender_name': sender_name,
                'is_internal_note': is_internal,
                'created_at': conversation.created_at.isoformat(),
                'ticket_id': self.ticket_id
            }
        )
        
        print(f"✅ Message broadcasted to room {self.room_group_name}")
    
    async def handle_ping(self):
        """Handle ping"""
        await self.send(text_data=json.dumps({
            'type': 'pong'
        }))
    
    # ========== GROUP EVENT HANDLERS ==========
    
    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message_id': event['message_id'],
            'message': event['message'],
            'sender_type': event['sender_type'],
            'sender_name': event['sender_name'],
            'is_internal_note': event['is_internal_note'],
            'created_at': event['created_at'],
            'ticket_id': event['ticket_id']
        }))
    
    # ========== DATABASE HELPERS ==========
    
    @database_sync_to_async
    def get_user_from_token(self, token):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
        
        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            return User.objects.get(id=user_id)
        except (InvalidToken, TokenError, User.DoesNotExist) as e:
            print(f"Token error: {e}")
            return None
    
    @database_sync_to_async
    def check_ticket_access(self, user, ticket_id):
        from .models import Ticket
        
        try:
            ticket = Ticket.objects.select_related('raised_by', 'raised_by__user', 'assigned_to').get(id=ticket_id)
            
            # Super admin can see all tickets
            if user.is_superuser:
                return True
            
            # Agent can see:
            # 1. Tickets assigned to them
            # 2. Unassigned tickets (assigned_to is None)
            if hasattr(user, 'agent_profile'):
                return ticket.assigned_to == user.agent_profile or ticket.assigned_to is None
            
            # Regular user can see own tickets
            return ticket.raised_by.user == user
            
        except Ticket.DoesNotExist:
            print(f"Ticket {ticket_id} not found")
            return False
    
    @database_sync_to_async
    def save_message(self, ticket_id, message, sender_type, is_internal, user):
        from .models import Ticket, Conversation
        
        try:
            ticket = Ticket.objects.get(id=ticket_id)
            
            conversation = Conversation.objects.create(
                ticket=ticket,
                sender_type=sender_type,
                message=message,
                is_internal_note=is_internal
            )
            
            # Update ticket status if user replied
            if sender_type == 'user' and ticket.status in ['resolved', 'closed']:
                ticket.status = 'open'
                ticket.save(update_fields=['status'])
            
            return conversation
            
        except Exception as e:
            print(f"Error saving message: {e}")
            return None
    
    @database_sync_to_async
    def get_sender_name(self, user, sender_type):
        from .models import UserProfile
        
        if sender_type == 'agent':
            return user.get_full_name() or user.username
        else:
            try:
                profile = UserProfile.objects.get(user=user)
                return profile.user.get_full_name() or profile.user.username
            except UserProfile.DoesNotExist:
                return user.username