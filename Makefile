.PHONY: help up down dev https status

help:
	@echo "Commands:"
	@echo "  make dev      Start backend (Docker) + frontend (Vite) for development"
	@echo "  make up       Build and start Docker Compose (HTTP)"
	@echo "  make https    Generate self-signed cert + start with HTTPS"
	@echo "  make down     Stop containers"
	@echo "  make status   Show each service status and the frontend URL"

dev:
	@echo "→ Démarrage backend Docker + Vite dev server…"
	docker compose up -d backend
	cd frontend && npm run dev

up:
	docker compose up --build

https:
	@read -p "IP ou domaine local (ex: 192.168.1.42) : " ADDR && bash scripts/gen-certs.sh "$$ADDR"
	docker compose -f docker-compose.yml -f docker-compose.https.yml up --build

down:
	docker compose down

status:
	@services=$$(docker compose config --services 2>/dev/null || echo "frontend"); \
	running=$$(docker compose ps --filter "status=running" --services 2>/dev/null); \
	for service in $$services; do \
		if echo "$$running" | grep -xq "$$service"; then \
			status=up; \
		else \
			status=down; \
		fi; \
		echo "$$service: $$status"; \
	done; \
	echo "URL: http://localhost:8080"

services: status
