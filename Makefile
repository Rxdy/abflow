.PHONY: help up down dev https status funnel e2e e2e-down

help:
	@echo "Commands:"
	@echo "  make dev      Start backend (Docker) + frontend (Vite) for development"
	@echo "  make up       Build and start Docker Compose (HTTP)"
	@echo "  make https    Generate self-signed cert + start with HTTPS"
	@echo "  make down     Stop containers"
	@echo "  make status   Show each service status and the frontend URL"
	@echo "  make funnel   Expose the app publicly via Tailscale Funnel (port 8080)"
	@echo "  make e2e      Start an isolated stack (port 8099) and run the Playwright e2e suite"
	@echo "  make e2e-down Stop and remove the e2e stack"

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

funnel:
	sudo tailscale funnel --bg 8080
	tailscale funnel status

e2e:
	@touch .env
	@mkdir -p /tmp/abflow-e2e-uploads
	@docker run --rm -v /tmp/abflow-e2e-uploads:/data alpine sh -c 'rm -rf /data/*'
	docker compose -p abflow-e2e --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml up -d --build
	@status=0; \
	(cd frontend && E2E_BASE_URL=http://localhost:8099 npx playwright test) || status=$$?; \
	docker compose -p abflow-e2e --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml down; \
	exit $$status

e2e-down:
	docker compose -p abflow-e2e --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml down
