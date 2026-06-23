#!/usr/bin/env bash
# Génère un certificat TLS self-signed pour nginx (réseau local).
# Usage : bash scripts/gen-certs.sh [IP_ou_domaine]
# Exemple : bash scripts/gen-certs.sh 192.168.1.42

set -euo pipefail

DOMAIN="${1:-192.168.1.1}"
CERT_DIR="$(dirname "$0")/../certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
  -keyout "$CERT_DIR/nginx.key" \
  -out    "$CERT_DIR/nginx.crt" \
  -subj   "/CN=${DOMAIN}" \
  -addext "subjectAltName=IP:${DOMAIN},DNS:localhost"

echo "✓ Certificat généré dans $CERT_DIR/"
echo "  Valide 10 ans pour : ${DOMAIN}"
echo ""
echo "Pour démarrer en HTTPS :"
echo "  docker compose -f docker-compose.yml -f docker-compose.https.yml up --build"
