package store

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Room struct {
	ID        uuid.UUID
	Code      string
	Name      string
	DmUserID  uuid.UUID
	CreatedAt time.Time
	Role      string
}

type RoomMember struct {
	UserID   uuid.UUID
	Username string
	Role     string
}

func (s *Store) CreateRoom(ctx context.Context, code, name string, dmUserID uuid.UUID) (Room, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Room{}, err
	}
	defer tx.Rollback(ctx)

	var r Room
	err = tx.QueryRow(ctx,
		`INSERT INTO rooms (code, name, dm_user_id)
		 VALUES ($1, $2, $3)
		 RETURNING id, code, name, dm_user_id, created_at`,
		code, name, dmUserID,
	).Scan(&r.ID, &r.Code, &r.Name, &r.DmUserID, &r.CreatedAt)
	if err != nil {
		return Room{}, err
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'dm')`,
		r.ID, dmUserID,
	)
	if err != nil {
		return Room{}, err
	}

	return r, tx.Commit(ctx)
}

func (s *Store) GetRoomByCode(ctx context.Context, code string) (Room, error) {
	var r Room
	err := s.pool.QueryRow(ctx,
		`SELECT id, code, name, dm_user_id, created_at FROM rooms WHERE code = $1`,
		code,
	).Scan(&r.ID, &r.Code, &r.Name, &r.DmUserID, &r.CreatedAt)
	return r, err
}

func (s *Store) GetRoomMembership(ctx context.Context, code string, userID uuid.UUID) (Room, string, error) {
	var r Room
	var role string
	err := s.pool.QueryRow(ctx,
		`SELECT r.id, r.code, r.name, r.dm_user_id, r.created_at, rm.role
		 FROM rooms r
		 JOIN room_members rm ON rm.room_id = r.id
		 WHERE r.code = $1 AND rm.user_id = $2`,
		code, userID,
	).Scan(&r.ID, &r.Code, &r.Name, &r.DmUserID, &r.CreatedAt, &role)
	return r, role, err
}

func (s *Store) ListUserRooms(ctx context.Context, userID uuid.UUID) ([]Room, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT r.id, r.code, r.name, r.dm_user_id, r.created_at, rm.role
		 FROM rooms r
		 JOIN room_members rm ON rm.room_id = r.id
		 WHERE rm.user_id = $1
		 ORDER BY r.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []Room
	for rows.Next() {
		var r Room
		if err := rows.Scan(&r.ID, &r.Code, &r.Name, &r.DmUserID, &r.CreatedAt, &r.Role); err != nil {
			return nil, err
		}
		rooms = append(rooms, r)
	}
	return rooms, rows.Err()
}

func (s *Store) GetRoomMembers(ctx context.Context, roomID uuid.UUID) ([]RoomMember, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT rm.user_id, u.username, rm.role
		 FROM room_members rm
		 JOIN users u ON u.id = rm.user_id
		 WHERE rm.room_id = $1
		 ORDER BY rm.role DESC, u.username`,
		roomID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []RoomMember
	for rows.Next() {
		var m RoomMember
		if err := rows.Scan(&m.UserID, &m.Username, &m.Role); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

func (s *Store) AddRoomMember(ctx context.Context, roomID, userID uuid.UUID) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'player')`,
		roomID, userID,
	)
	return err
}

func (s *Store) DeleteRoom(ctx context.Context, roomID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM rooms WHERE id = $1`, roomID)
	return err
}
