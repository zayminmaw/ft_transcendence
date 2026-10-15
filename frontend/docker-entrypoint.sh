#!/bin/sh
set -e

# Generate self-signed SSL certificate if none exists
mkdir -p /etc/nginx/ssl
if [ ! -f /etc/nginx/ssl/server.crt ] || [ ! -f /etc/nginx/ssl/server.key ]; then
	echo "Generating self-signed SSL/TLS certificate for localhost..."
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout /etc/nginx/ssl/server.key \
		-out /etc/nginx/ssl/server.crt \
		-subj "/CN=localhost" \
		-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

exec "$@"

