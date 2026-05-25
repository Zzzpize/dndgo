package store

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID
	Email         string
	Username      string
	PasswordHash  string
	EmailVerified bool
	CreatedAt     time.Time
}

func (s *Store) CreateUser(ctx context.Context, email, username, passwordHash string, emailVerified bool) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`INSERT INTO users (email, username, password_hash, email_verified)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, email, username, password_hash, email_verified, created_at`,
		email, username, passwordHash, emailVerified,
	).Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.EmailVerified, &u.CreatedAt)
	return u, err
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, username, password_hash, email_verified, created_at FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.EmailVerified, &u.CreatedAt)
	return u, err
}

func (s *Store) GetUserByID(ctx context.Context, id uuid.UUID) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, username, password_hash, email_verified, created_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.EmailVerified, &u.CreatedAt)
	return u, err
}

func (s *Store) SetVerifyCode(ctx context.Context, email, code string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET verify_code = $2, verify_expires_at = $3 WHERE email = $1 AND email_verified = false`,
		email, code, expiresAt)
	return err
}

func (s *Store) VerifyEmailCode(ctx context.Context, email, code string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`UPDATE users
		 SET email_verified = true, verify_code = NULL, verify_expires_at = NULL
		 WHERE email = $1 AND verify_code = $2 AND verify_expires_at > NOW() AND email_verified = false
		 RETURNING id, email, username, password_hash, email_verified, created_at`,
		email, code,
	).Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.EmailVerified, &u.CreatedAt)
	return u, err
}
