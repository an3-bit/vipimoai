"""
ASGI config for vipimoai_backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vipimoai_backend.settings')

# ASGI application with Channels support. When Channels is not available,
# fall back to Django's ASGI application.
try:
	from channels.routing import ProtocolTypeRouter, URLRouter
	from channels.auth import AuthMiddlewareStack
	from django.urls import path, re_path
	import vision_ai.routing as vision_routing

	django_asgi_app = get_asgi_application()

	application = ProtocolTypeRouter({
		"http": django_asgi_app,
		"websocket": AuthMiddlewareStack(
			URLRouter(vision_routing.websocket_urlpatterns)
		),
	})
except Exception:
	# channels not installed or misconfigured; fallback
	application = get_asgi_application()
