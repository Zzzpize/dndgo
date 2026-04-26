.PHONY: up down build logs ps clean backend-tidy proto

## Start all services
up:
	docker-compose up --build

## Start in background
up-d:
	docker-compose up --build -d

## Stop all services
down:
	docker-compose down

## Stop and remove volumes
down-v:
	docker-compose down -v

## Build all images
build:
	docker-compose build

## Show logs (all or specific service: make logs s=backend)
logs:
	docker-compose logs -f $(s)

## Show container status
ps:
	docker-compose ps

## Remove build artifacts and volumes
clean:
	docker-compose down -v --rmi local
	rm -rf data/

## Run go mod tidy in backend
backend-tidy:
	cd backend && go mod tidy

## Generate protobuf (requires protoc)
proto:
	protoc --go_out=backend/gen/proto --go_opt=paths=source_relative \
		--proto_path=backend/proto \
		backend/proto/events.proto

## Run backend locally (without Docker)
backend-run:
	cd backend && go run ./cmd/server

## Install frontend deps
frontend-install:
	cd frontend && npm install

## Run frontend locally (without Docker)
frontend-dev:
	cd frontend && npm run dev
