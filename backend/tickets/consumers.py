import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from urllib.parse import parse_qs


class TicketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Called when WebSocket connects"""
        print("🔌 WebSocket connection attempt")

        # Accept connection FIRST to avoid 1006 errors
        # We'll close it immediately if auth fails
        await self.accept()

        # Get token from URL query string
        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        print(f"🔑 Token present: {token is not None}")

        if not token:
            print("❌ No token, closing connection")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Authentication required'
            }))
            await self.close(code=4001)
            return

        # Get user from token (async-safe)
        user = await self.get_user_from_token(token)

        if not user:
            print("❌ Invalid token, closing connection")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Invalid token'
            }))
            await self.close(code=4001)
            return

        # Store user in scope
        self.scope['user'] = user

        # Get ticket ID from URL (may be None for dashboard connections)
        self.ticket_id = self.scope['url_route']['kwargs'].get('ticket_id')

        # ----- DASHBOARD CONNECTION (no ticket_id) -----
        if not self.ticket_id:
            self.room_group_name = None

            # Check agent/admin role using async-safe helper
            is_agent_or_admin = await self.user_is_agent_or_admin(user)

            if not is_agent_or_admin:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'error': 'Access denied'
                }))
                await self.close(code=4003)
                return

            self.dashboard_group_name = "dashboard_updates"
            await self.channel_layer.group_add(
                self.dashboard_group_name,
                self.channel_name
            )

            print(f"✅ Dashboard WebSocket connected, user: {user.username}")
            await self.send(text_data=json.dumps({
                'type': 'connection',
                'status': 'connected',
                'mode': 'dashboard',
                'user': user.username
            }))
            return

        # ----- TICKET CHAT CONNECTION -----
        self.dashboard_group_name = None
        self.room_group_name = f"ticket_{self.ticket_id}"

        # Check ticket access using async-safe helper
        has_access = await self.check_ticket_access(user, self.ticket_id)

        if not has_access:
            print(f"❌ User {user.username} does not have access to ticket {self.ticket_id}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Access denied to this ticket'
            }))
            await self.close(code=4003)
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        print(f"✅ WebSocket connected for ticket {self.ticket_id}, user: {user.username}")

        await self.send(text_data=json.dumps({
            'type': 'connection',
            'status': 'connected',
            'mode': 'ticket',
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

        if hasattr(self, 'dashboard_group_name') and self.dashboard_group_name:
            await self.channel_layer.group_discard(
                self.dashboard_group_name,
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
        if not hasattr(self, 'ticket_id') or not self.ticket_id:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'No ticket context for this connection'
            }))
            return

        message = data.get('message', '')
        sender_type = data.get('sender_type', 'user')
        is_internal = data.get('is_internal_note', False)

        if not message or not message.strip():
            return

        user = self.scope['user']

        print(f"💬 New message from {sender_type}: {message[:50]}...")

        # Save message to database (async-safe)
        conversation = await self.save_message(
            self.ticket_id,
            message.strip(),
            sender_type,
            is_internal,
            user
        )

        if not conversation:
            print("❌ Failed to save message")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': 'Failed to save message'
            }))
            return

        # Get sender name (async-safe)
        sender_name = await self.get_sender_name(user, sender_type)

        # Broadcast to ticket room
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

        # Also notify dashboard group about new activity (only for non-internal messages)
        if not is_internal:
            ticket_data = await self.get_ticket_summary(self.ticket_id)
            if ticket_data:
                await self.channel_layer.group_send(
                    "dashboard_updates",
                    {
                        'type': 'ticket_update',
                        'update_type': 'new_message',
                        'ticket_id': self.ticket_id,
                        'ticket': ticket_data
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

    async def ticket_update(self, event):
        """Send dashboard ticket update to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'ticket_update',
            'update_type': event.get('update_type', 'updated'),
            'ticket_id': event['ticket_id'],
            'ticket': event.get('ticket', {})
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
    def user_is_agent_or_admin(self, user):
        """
        Check if user is an agent or superuser.
        This runs in a thread pool so ORM access is safe.
        """
        if user.is_superuser:
            return True
        # Force evaluation of the related object in this sync context
        return hasattr(user, 'agent_profile') and user.agent_profile is not None

    @database_sync_to_async
    def check_ticket_access(self, user, ticket_id):
        from .models import Ticket

        try:
            ticket = Ticket.objects.select_related(
                'raised_by', 'raised_by__user', 'assigned_to'
            ).get(id=ticket_id)

            # Super admin can see all tickets
            if user.is_superuser:
                return True

            # Agent can see:
            # 1. Tickets assigned to them
            # 2. Unassigned tickets
            # NOTE: hasattr() here is safe because we're inside database_sync_to_async
            if hasattr(user, 'agent_profile') and user.agent_profile is not None:
                return (
                    ticket.assigned_to == user.agent_profile
                    or ticket.assigned_to is None
                )

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

            # Reopen ticket if user replied on a resolved/closed ticket
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

    @database_sync_to_async
    def get_ticket_summary(self, ticket_id):
        """Return a JSON-serializable dict for the dashboard update"""
        from .models import Ticket

        try:
            ticket = Ticket.objects.select_related(
                'raised_by', 'raised_by__user', 'assigned_to'
            ).get(id=ticket_id)

            return {
                'id': ticket.id,
                'title': ticket.title,
                'status': ticket.status,
                'priority': ticket.priority,
                'customer_name': (
                    ticket.raised_by.user.get_full_name()
                    or ticket.raised_by.user.username
                    if ticket.raised_by and ticket.raised_by.user
                    else 'Guest'
                ),
                'assigned_to_name': (
                    ticket.assigned_to.user.get_full_name()
                    or ticket.assigned_to.user.username
                    if ticket.assigned_to and hasattr(ticket.assigned_to, 'user')
                    else None
                ),
                'created_at': ticket.created_at.isoformat(),
                'updated_at': ticket.updated_at.isoformat(),
            }
        except Exception as e:
            print(f"Error getting ticket summary: {e}")
            return None