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

func (s *Store) GetUserByUsername(ctx context.Context, username string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`SELECT id, email, username, password_hash, email_verified, created_at FROM users WHERE username = $1`,
		username,
	).Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.EmailVerified, &u.CreatedAt)
	return u, err
}

func (s *Store) UpdateUsername(ctx context.Context, id uuid.UUID, username string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`UPDATE users SET username = $2 WHERE id = $1
		 RETURNING id, email, username, password_hash, email_verified, created_at`,
		id, username,
	).Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.EmailVerified, &u.CreatedAt)
	return u, err
}

func (s *Store) UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET password_hash = $2 WHERE id = $1`,
		id, passwordHash)
	return err
}

func (s *Store) InitEmailChange(ctx context.Context, id uuid.UUID, pendingEmail, code string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET pending_email = $2, pending_email_code = $3, pending_email_expires_at = $4 WHERE id = $1`,
		id, pendingEmail, code, expiresAt)
	return err
}

func (s *Store) ConfirmEmailChange(ctx context.Context, id uuid.UUID, code string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`UPDATE users
		 SET email = pending_email, pending_email = NULL, pending_email_code = NULL, pending_email_expires_at = NULL
		 WHERE id = $1 AND pending_email_code = $2 AND pending_email_expires_at > NOW()
		 RETURNING id, email, username, password_hash, email_verified, created_at`,
		id, code,
	).Scan(&u.ID, &u.Email, &u.Username, &u.PasswordHash, &u.EmailVerified, &u.CreatedAt)
	return u, err
}

type PasswordResetToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Token     string
	ExpiresAt time.Time
	Used      bool
}

func (s *Store) CreatePasswordResetToken(ctx context.Context, userID uuid.UUID, token string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
		userID, token, expiresAt)
	return err
}

func (s *Store) UsePasswordResetToken(ctx context.Context, token string) (uuid.UUID, error) {
	var userID uuid.UUID
	err := s.pool.QueryRow(ctx,
		`UPDATE password_reset_tokens SET used = true
		 WHERE token = $1 AND used = false AND expires_at > NOW()
		 RETURNING user_id`,
		token,
	).Scan(&userID)
	return userID, err
}
