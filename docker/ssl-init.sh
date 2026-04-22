#!/bin/sh
# Run this ONCE on the Hetzner VPS to obtain the initial SSL certificate.
# DNS must already point tradex.haspex.co → this server's IP before running.
#
# Usage:  bash docker/ssl-init.sh

DOMAIN="tradex.haspex.co"
EMAIL="shoukath.apa@gmail.com"

echo "==> Starting nginx with HTTP-only config for ACME challenge..."
docker compose up -d nginx

echo "==> Requesting certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "==> Reloading nginx to load the new certificate..."
docker compose exec nginx nginx -s reload

echo ""
echo "Done! HTTPS is now active for https://$DOMAIN"
echo "Auto-renewal is handled by the certbot container (runs every 12 hours)."
