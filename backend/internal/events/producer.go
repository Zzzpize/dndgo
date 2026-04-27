package events

import (
	"context"
	"log"

	"github.com/segmentio/kafka-go"
)

type Producer struct {
	writer *kafka.Writer
}

func NewProducer(brokers []string) *Producer {
	w := &kafka.Writer{
		Addr:     kafka.TCP(brokers...),
		Topic:    Topic,
		Balancer: &kafka.Hash{},
	}
	return &Producer{writer: w}
}

func (p *Producer) Publish(ctx context.Context, e *GameEvent) {
	data, err := Marshal(e)
	if err != nil {
		log.Printf("events: marshal: %v", err)
		return
	}
	msg := kafka.Message{
		Key:   []byte(e.RoomID),
		Value: data,
	}
	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		log.Printf("events: publish %s: %v", e.EventType, err)
	}
}

func (p *Producer) Close() {
	if err := p.writer.Close(); err != nil {
		log.Printf("events: producer close: %v", err)
	}
}
