.PHONY: up down build logs ps clean backend-tidy proto


up:
	docker-compose up --build


up-d:
	docker-compose up --build -d


down:
	docker-compose down


down-v:
	docker-compose down -v


build:
	docker-compose build


logs:
	docker-compose logs -f $(s)


ps:
	docker-compose ps


clean:
	docker-compose down -v --rmi local
	rm -rf data/


backend-tidy:
	cd backend && go mod tidy


proto:
	protoc --go_out=backend/gen/proto --go_opt=paths=source_relative \
		--proto_path=backend/proto \
		backend/proto/events.proto


backend-run:
	cd backend && go run ./cmd/server


frontend-install:
	cd frontend && npm install


frontend-dev:
	cd frontend && npm run dev
