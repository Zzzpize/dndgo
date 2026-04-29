package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	migrate "github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/zzzpize/dndgo/backend/internal/auth"
	"github.com/zzzpize/dndgo/backend/internal/bestiary"
	"github.com/zzzpize/dndgo/backend/internal/character"
	"github.com/zzzpize/dndgo/backend/internal/events"
	"github.com/zzzpize/dndgo/backend/internal/game"
	"github.com/zzzpize/dndgo/backend/internal/hub"
	appmw "github.com/zzzpize/dndgo/backend/internal/middleware"
	"github.com/zzzpize/dndgo/backend/internal/store"
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

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "./static"
	}

	publicURL := os.Getenv("PUBLIC_URL")
	if publicURL == "" {
		publicURL = "http://localhost:" + port
	}

	kafkaBrokers := strings.Split(os.Getenv("KAFKA_BROKERS"), ",")
	if len(kafkaBrokers) == 0 || kafkaBrokers[0] == "" {
		kafkaBrokers = []string{"kafka:9092"}
	}

	if err := os.MkdirAll(staticDir+"/maps", 0o755); err != nil {
		log.Fatalf("create static dir: %v", err)
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

	st := store.New(pool)

	producer := events.NewProducer(kafkaBrokers)
	defer producer.Close()

	consumer := events.NewConsumer(kafkaBrokers, st)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go consumer.Run(ctx)

	wsHub := hub.NewHub(st, producer)

	authHandler := auth.NewHandler(st, jwtSecret)
	gameHandler := game.NewHandler(st, wsHub, staticDir, publicURL)
	charHandler := character.NewHandler(st)
	bestiaryHandler := bestiary.NewHandler(st)

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(appmw.RateLimit(20, time.Second))
				r.Post("/register", authHandler.Register)
				r.Post("/login", authHandler.Login)
			})
			r.Group(func(r chi.Router) {
				r.Use(auth.JWT(jwtSecret))
				r.Get("/me", authHandler.Me)
			})
		})

		r.Route("/rooms", func(r chi.Router) {
			r.Use(auth.JWT(jwtSecret))
			r.Post("/", gameHandler.CreateRoom)
			r.Get("/", gameHandler.ListRooms)
			r.Post("/join", gameHandler.JoinRoom)
			r.Get("/{code}", gameHandler.GetRoom)
			r.Delete("/{code}", gameHandler.DeleteRoom)
			r.Post("/{code}/map", gameHandler.UploadMap)
			r.Post("/{code}/characters", charHandler.Create)
			r.Get("/{code}/characters", charHandler.ListByRoom)
			r.Get("/{code}/events", gameHandler.ListEvents)
		})

		r.Route("/characters", func(r chi.Router) {
			r.Use(auth.JWT(jwtSecret))
			r.Get("/{id}", charHandler.Get)
			r.Put("/{id}", charHandler.Update)
			r.Patch("/{id}/hp", charHandler.PatchHP)
			r.Delete("/{id}", charHandler.Delete)
		})

		r.Route("/bestiary", func(r chi.Router) {
			r.Use(auth.JWT(jwtSecret))
			r.Get("/", bestiaryHandler.List)
			r.Get("/{id}", bestiaryHandler.Get)
		})

		r.Get("/ws/{code}", wsHub.ServeWS(jwtSecret))
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("server starting on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("server forced to shutdown: %v", err)
	}
	log.Println("server stopped")
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
