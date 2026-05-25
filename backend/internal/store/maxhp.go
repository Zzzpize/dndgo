package store

import (
	"regexp"
	"strconv"
	"strings"
)

var maxHPRe = regexp.MustCompile(`^\d+`)

// ParseMaxHP validates a max_hp string.
// Valid: "20", "20 (2d10+8)" → (20, false, true)
// Valid: "Inf" or "∞"        → (0, true, true)
// Invalid: anything else     → (0, false, false)
func ParseMaxHP(s string) (numeric int, isInf bool, valid bool) {
	s = strings.TrimSpace(s)
	if strings.EqualFold(s, "inf") || s == "∞" {
		return 0, true, true
	}
	m := maxHPRe.FindString(s)
	if m == "" {
		return 0, false, false
	}
	n, err := strconv.Atoi(m)
	if err != nil || n <= 0 {
		return 0, false, false
	}
	return n, false, true
}

// NumericMaxHP returns the numeric cap (0 for Inf, fallback 999999 for invalid).
func NumericMaxHP(s string) int {
	n, isInf, valid := ParseMaxHP(s)
	if isInf || !valid {
		return 0
	}
	return n
}
