package events

import (
	"context"
	"log"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"

	"github.com/zzzpize/dndgo/backend/internal/store"
)

type Consumer struct {
	reader *kafka.Reader
	store  *store.Store
}

func NewConsumer(brokers []string, st *store.Store) *Consumer {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		Topic:    Topic,
		GroupID:  "dndgo-event-store",
		MinBytes: 1,
		MaxBytes: 10e6,
	})
	return &Consumer{reader: r, store: st}
}

func (c *Consumer) Run(ctx context.Context) {
	log.Println("events consumer: starting")
	for {
		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				log.Println("events consumer: shutting down")
				return
			}
			log.Printf("events consumer: fetch: %v", err)
			continue
		}

		ev, err := Unmarshal(msg.Value)
		if err != nil {
			log.Printf("events consumer: unmarshal: %v", err)
			c.reader.CommitMessages(ctx, msg)
			continue
		}

		roomID, err := uuid.Parse(ev.RoomID)
		if err != nil {
			log.Printf("events consumer: bad room_id: %v", err)
			c.reader.CommitMessages(ctx, msg)
			continue
		}

		if err := c.store.InsertGameEvent(ctx, roomID, ev.EventType, ev.Payload, ev.OccurredAt); err != nil {
			log.Printf("events consumer: insert: %v", err)
			continue
		}

		if err := c.reader.CommitMessages(ctx, msg); err != nil {
			log.Printf("events consumer: commit: %v", err)
		}
	}
}

func (c *Consumer) Close() {
	if err := c.reader.Close(); err != nil {
		log.Printf("events consumer: close: %v", err)
	}
}
