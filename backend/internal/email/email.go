package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type Sender struct {
	apiKey string
	from   string
}

func NewSender(apiKey, from string) *Sender {
	if from == "" {
		from = "onboarding@resend.dev"
	}
	return &Sender{apiKey: apiKey, from: from}
}

func (s *Sender) Enabled() bool { return s.apiKey != "" }

func (s *Sender) SendVerification(to, username, code string) {
	if !s.Enabled() {
		return
	}
	body, _ := json.Marshal(map[string]any{
		"from":    s.from,
		"to":      []string{to},
		"subject": "Подтверждение регистрации — D&D VTT",
		"html": fmt.Sprintf(`<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#333">
<h2>Привет, %s!</h2>
<p>Твой код подтверждения для D&amp;D VTT:</p>
<div style="font-size:2.5em;font-family:monospace;letter-spacing:0.3em;background:#f4f4f4;padding:16px 24px;border-radius:6px;display:inline-block;margin:16px 0">%s</div>
<p style="color:#888;font-size:0.9em">Код действителен 24 часа. Если ты не регистрировался — просто проигнорируй это письмо.</p>
</body></html>`, username, code),
	})

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		log.Printf("email: build request: %v", err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("email: send: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("email: resend returned %d", resp.StatusCode)
	}
}
