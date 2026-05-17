import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from urllib.parse import parse_qs


class TicketConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        print("🔌 WebSocket connection attempt")
        await self.accept()

        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        token        = query_params.get('token',  [None])[0]
        # Customers pass their email + ticket_id instead of a JWT token
        pub_email    = query_params.get('email',  [None])[0]
        pub_ticket   = query_params.get('tid',    [None])[0]

        self.ticket_id         = self.scope['url_route']['kwargs'].get('ticket_id')
        self.room_group_name   = None
        self.dashboard_group_name = None

        # ── DASHBOARD CONNECTION (/ws/notifications/) ─────────────────────
        if not self.ticket_id:
            if not token:
                await self._reject(4001, 'Authentication required')
                return

            user = await self.get_user_from_token(token)
            if not user:
                await self._reject(4001, 'Invalid token')
                return

            is_staff = await self.user_is_agent_or_admin(user)
            if not is_staff:
                await self._reject(4003, 'Access denied')
                return

            self.scope['user']        = user
            self.dashboard_group_name = "dashboard_updates"
            await self.channel_layer.group_add(self.dashboard_group_name, self.channel_name)

            print(f"✅ Dashboard WS connected — user: {user.username}")
            await self.send(text_data=json.dumps({
                'type': 'connection', 'status': 'connected',
                'mode': 'dashboard',  'user': user.username
            }))
            return

        # ── TICKET CHAT CONNECTION (/ws/tickets/<id>/) ────────────────────
        self.room_group_name = f"ticket_{self.ticket_id}"

        # — Agent / admin: JWT auth —
        if token:
            user = await self.get_user_from_token(token)
            if not user:
                await self._reject(4001, 'Invalid token')
                return

            # Agents and admins can access ANY ticket (for viewing/replying)
            # Only regular users are restricted to their own tickets via JWT.
            can_access = await self.check_ticket_access_jwt(user, self.ticket_id)
            if not can_access:
                await self._reject(4003, 'Access denied to this ticket')
                return

            self.scope['user'] = user
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)

            print(f"✅ Ticket WS connected — ticket #{self.ticket_id}, user: {user.username}")
            await self.send(text_data=json.dumps({
                'type': 'connection', 'status': 'connected',
                'mode': 'ticket',     'ticket_id': self.ticket_id,
                'user': user.username
            }))
            return

        # — Customer: email + ticket_id auth (no JWT required) —
        if pub_email and pub_ticket:
            can_access = await self.check_ticket_access_public(pub_email, self.ticket_id)
            if not can_access:
                await self._reject(4003, 'Access denied — email does not match ticket')
                return

            # Store a lightweight identity for public users
            self.scope['user']         = None
            self.scope['public_email'] = pub_email
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)

            print(f"✅ Ticket WS connected (public) — ticket #{self.ticket_id}, email: {pub_email}")
            await self.send(text_data=json.dumps({
                'type': 'connection', 'status': 'connected',
                'mode': 'ticket_public', 'ticket_id': self.ticket_id
            }))
            return

        # No valid auth at all
        await self._reject(4001, 'Authentication required')

    # ── helpers ───────────────────────────────────────────────────────────

    async def _reject(self, code, reason):
        print(f"❌ WS rejected ({code}): {reason}")
        await self.send(text_data=json.dumps({'type': 'error', 'error': reason}))
        await self.close(code=code)

    async def disconnect(self, close_code):
        print(f"🔌 WS disconnected: {close_code}")
        if self.room_group_name:
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        if self.dashboard_group_name:
            await self.channel_layer.group_discard(self.dashboard_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data         = json.loads(text_data)
            message_type = data.get('type', 'message')
            if message_type == 'message':
                await self.handle_chat_message(data)
            elif message_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'type': 'error', 'error': 'Invalid JSON'}))

    async def handle_chat_message(self, data):
        if not self.ticket_id:
            await self.send(text_data=json.dumps({'type': 'error', 'error': 'No ticket context'}))
            return

        message     = (data.get('message', '') or '').strip()
        sender_type = data.get('sender_type', 'user')
        is_internal = data.get('is_internal_note', False)

        if not message:
            return

        user        = self.scope.get('user')
        pub_email   = self.scope.get('public_email')

        print(f"💬 [{sender_type}] {message[:60]}")

        # Save to DB
        conversation = await self.save_message(
            self.ticket_id, message, sender_type, is_internal, user, pub_email
        )
        if not conversation:
            await self.send(text_data=json.dumps({'type': 'error', 'error': 'Failed to save message'}))
            return

        sender_name = await self.get_sender_name(user, sender_type, pub_email)

        # Broadcast to everyone in the ticket room (agent + customer both get it)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type':             'chat_message',
                'message_id':       conversation.id,
                'message':          message,
                'sender_type':      sender_type,
                'sender_name':      sender_name,
                'is_internal_note': is_internal,
                'created_at':       conversation.created_at.isoformat(),
                'ticket_id':        self.ticket_id,
            }
        )

        # Notify dashboard (non-internal only)
        if not is_internal:
            ticket_data = await self.get_ticket_summary(self.ticket_id)
            if ticket_data:
                await self.channel_layer.group_send(
                    "dashboard_updates",
                    {
                        'type':        'ticket_update',
                        'update_type': 'new_message',
                        'ticket_id':   self.ticket_id,
                        'ticket':      ticket_data,
                    }
                )

        print(f"✅ Broadcasted to {self.room_group_name}")

    # ── Group event handlers (called by channel layer) ────────────────────

    async def chat_message(self, event):
        """Deliver a chat message to this WebSocket client."""
        await self.send(text_data=json.dumps({
            'type':             'message',          # frontend listens for 'message'
            'message_id':       event['message_id'],
            'message':          event['message'],
            'sender_type':      event['sender_type'],
            'sender_name':      event['sender_name'],
            'is_internal_note': event['is_internal_note'],
            'created_at':       event['created_at'],
            'ticket_id':        event['ticket_id'],
        }))

    async def ticket_update(self, event):
        """Deliver a dashboard ticket-update to this WebSocket client."""
        await self.send(text_data=json.dumps({
            'type':        'ticket_update',
            'update_type': event.get('update_type', 'updated'),
            'ticket_id':   event['ticket_id'],
            'ticket':      event.get('ticket', {}),
        }))

    # ── DB helpers ────────────────────────────────────────────────────────

    @database_sync_to_async
    def get_user_from_token(self, token):
        from django.contrib.auth.models import User
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
        try:
            user_id = AccessToken(token)['user_id']
            return User.objects.get(id=user_id)
        except (InvalidToken, TokenError, User.DoesNotExist) as e:
            print(f"Token error: {e}")
            return None

    @database_sync_to_async
    def user_is_agent_or_admin(self, user):
        if user.is_superuser:
            return True
        return hasattr(user, 'agent_profile') and user.agent_profile is not None

    @database_sync_to_async
    def check_ticket_access_jwt(self, user, ticket_id):
        """
        JWT-authenticated access check.
        - Superadmin  → all tickets
        - Agent       → ALL tickets (they need to view/reply to any)
        - Regular user→ only their own tickets
        """
        from .models import Ticket
        try:
            ticket = Ticket.objects.select_related('raised_by__user').get(id=ticket_id)

            if user.is_superuser:
                return True

            # Any registered agent can access any ticket
            if hasattr(user, 'agent_profile') and user.agent_profile is not None:
                return True

            # Regular logged-in user — only their own ticket
            return ticket.raised_by.user == user

        except Ticket.DoesNotExist:
            return False

    @database_sync_to_async
    def check_ticket_access_public(self, email, ticket_id):
        """
        Public (no-JWT) access: customer provides their email.
        They can only connect to their own ticket.
        """
        from .models import Ticket
        try:
            ticket = Ticket.objects.select_related('raised_by__user').get(id=ticket_id)
            return ticket.raised_by.user.email == email
        except Ticket.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, ticket_id, message, sender_type, is_internal, user, pub_email=None):
        from .models import Ticket, Conversation
        try:
            ticket       = Ticket.objects.get(id=ticket_id)
            conversation = Conversation.objects.create(
                ticket=ticket,
                sender_type=sender_type,
                message=message,
                is_internal_note=is_internal,
            )
            if sender_type == 'user' and ticket.status in ['resolved', 'closed']:
                ticket.status = 'open'
                ticket.save(update_fields=['status', 'updated_at'])
            return conversation
        except Exception as e:
            print(f"Error saving message: {e}")
            return None

    @database_sync_to_async
    def get_sender_name(self, user, sender_type, pub_email=None):
        from .models import UserProfile
        if user:
            if sender_type == 'agent':
                return user.get_full_name() or user.username
            try:
                profile = UserProfile.objects.get(user=user)
                return profile.user.get_full_name() or profile.user.username
            except UserProfile.DoesNotExist:
                return user.username
        # Public customer
        if pub_email:
            try:
                from django.contrib.auth.models import User as DjangoUser
                u = DjangoUser.objects.get(email=pub_email)
                return u.get_full_name() or u.username
            except Exception:
                return pub_email.split('@')[0]
        return 'Customer'

    @database_sync_to_async
    def get_ticket_summary(self, ticket_id):
        from .models import Ticket
        try:
            ticket = Ticket.objects.select_related('raised_by__user', 'assigned_to__user').get(id=ticket_id)
            return {
                'id':             ticket.id,
                'title':          ticket.title,
                'status':         ticket.status,
                'priority':       ticket.priority,
                'customer_name':  (
                    ticket.raised_by.user.get_full_name() or ticket.raised_by.user.username
                    if ticket.raised_by and ticket.raised_by.user else 'Guest'
                ),
                'assigned_to_name': (
                    ticket.assigned_to.user.get_full_name() or ticket.assigned_to.user.username
                    if ticket.assigned_to and hasattr(ticket.assigned_to, 'user') else None
                ),
                'created_at':  ticket.created_at.isoformat(),
                'updated_at':  ticket.updated_at.isoformat(),
            }
        except Exception as e:
            print(f"Error getting ticket summary: {e}")
            return None