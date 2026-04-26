package httputil

import (
	"encoding/json"
	"net/http"
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

type errBody struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

func Error(w http.ResponseWriter, status int, message, code string) {
	JSON(w, status, errBody{Error: message, Code: code})
}
