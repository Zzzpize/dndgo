package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	migrate "github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zzzpize/dndgo/backend/internal/bestiary"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	runMigrations(dbURL)

	pool := connectDB(dbURL)
	defer pool.Close()

	bestiaryPath := os.Getenv("BESTIARY_PATH")
	if bestiaryPath != "" {
		if err := bestiary.MaybeImport(context.Background(), pool, bestiaryPath); err != nil {
			log.Printf("bestiary import warning: %v", err)
		}
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	log.Printf("server starting on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func runMigrations(dbURL string) {
	migrateURL := strings.NewReplacer(
		"postgres://", "pgx5://",
		"postgresql://", "pgx5://",
	).Replace(dbURL)

	m, err := migrate.New("file://db/migrations", migrateURL)
	if err != nil {
		log.Fatalf("migrate init: %v", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("migrate up: %v", err)
	}
	log.Println("migrations applied")
}

func connectDB(dbURL string) *pgxpool.Pool {
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("pgxpool connect: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("pgxpool ping: %v", err)
	}
	log.Println("database connected")
	return pool
}
