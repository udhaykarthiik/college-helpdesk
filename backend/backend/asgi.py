"""
ASGI config for backend project.
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# IMPORTANT: Initialize Django ASGI app FIRST, before any other Django imports.
# This ensures apps are fully loaded before consumers try to import models.
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# Only import channels/consumers AFTER Django is ready
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import re_path
from tickets.consumers import TicketConsumer

# NOTE: We do NOT use AuthMiddlewareStack here because we handle
# JWT token auth manually inside the consumer (via query string).
# AuthMiddlewareStack only handles Django session auth, not JWT.
websocket_urlpatterns = [
    # Ticket-specific chat: /ws/tickets/42/?token=...
    re_path(r"^ws/tickets/(?P<ticket_id>\d+)/$", TicketConsumer.as_asgi()),
    # Dashboard notifications (no ticket_id): /ws/notifications/?token=...
    re_path(r"^ws/notifications/$", TicketConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})