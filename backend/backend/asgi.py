"""
ASGI config for backend project.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Initialize Django ASGI application first
django_asgi_app = get_asgi_application()

# Now import channels and consumers (Django is ready)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import re_path, path
from tickets.consumers import TicketConsumer

# WebSocket URL patterns
websocket_urlpatterns = [
    path("ws/tickets/<int:ticket_id>/", TicketConsumer.as_asgi()),
    path("ws/notifications/", TicketConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})