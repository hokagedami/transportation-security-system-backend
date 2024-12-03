.PHONY: help install dev up down logs test clean

help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies for all services"
	@echo "  make dev        - Start all services in development mode"
	@echo "  make up         - Start all services with Docker"
	@echo "  make down       - Stop all Docker services"
	@echo "  make logs       - View Docker logs"
	@echo "  make test       - Run tests for all services"
	@echo "  make clean      - Clean node_modules and Docker volumes"

install:
	@echo "Installing dependencies for all services..."
	@for service in auth-service rider-service jacket-service payment-service sms-service verification-service; do \
		echo "Installing $$service dependencies..."; \
		cd services/$$service && npm install && cd ../..; \
	done

dev:
	@echo "Starting all services in development mode..."
	@echo "This requires multiple terminal windows. Use 'make up' for Docker instead."

up:
	@echo "Starting all services with Docker..."
	docker-compose up -d

down:
	@echo "Stopping all Docker services..."
	docker-compose down

logs:
	docker-compose logs -f

test:
	@echo "Running tests for all services..."
	@for service in auth-service rider-service jacket-service payment-service sms-service verification-service; do \
		echo "Testing $$service..."; \
		cd services/$$service && npm test && cd ../..; \
	done

clean:
	@echo "Cleaning up..."
	@for service in auth-service rider-service jacket-service payment-service sms-service verification-service; do \
		echo "Cleaning $$service..."; \
		rm -rf services/$$service/node_modules; \
	done
	docker-compose down -v