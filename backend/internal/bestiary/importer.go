package bestiary

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type monsterJSON struct {
	NameRu           string          `json:"name_ru"`
	NameEn           string          `json:"name_en"`
	TypeAndAlignment string          `json:"type_and_alignment"`
	ArmorClass       string          `json:"armor_class"`
	HitPoints        string          `json:"hit_points"`
	Speed            string          `json:"speed"`
	Abilities        json.RawMessage `json:"abilities"`
	Misc             json.RawMessage `json:"misc"`
	Actions          json.RawMessage `json:"actions"`
	Reactions        json.RawMessage `json:"reactions"`
	BonusActions     json.RawMessage `json:"bonus_actions"`
	LegendaryActions json.RawMessage `json:"legendary_actions"`
	LairActions      json.RawMessage `json:"lair_actions"`
	RegionalEffects  json.RawMessage `json:"regional_effects"`
	MythicActions    json.RawMessage `json:"mythic_actions"`
}

func MaybeImport(ctx context.Context, pool *pgxpool.Pool, bestiaryPath string) error {
	var count int64
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM monsters").Scan(&count); err != nil {
		return fmt.Errorf("count monsters: %w", err)
	}
	if count > 0 {
		log.Printf("bestiary: %d monsters already present, skipping import", count)
		return nil
	}

	monsters, err := loadFromDir(bestiaryPath)
	if err != nil {
		return err
	}
	if len(monsters) == 0 {
		log.Printf("bestiary: no .json files found in %s", bestiaryPath)
		return nil
	}

	seen := make(map[string]bool, len(monsters))
	unique := monsters[:0]
	for _, m := range monsters {
		if !seen[m.NameRu] {
			seen[m.NameRu] = true
			unique = append(unique, m)
		}
	}
	monsters = unique

	log.Printf("bestiary: importing %d monsters...", len(monsters))

	rows := make([][]any, 0, len(monsters))
	for _, m := range monsters {
		rows = append(rows, []any{
			m.NameRu, m.NameEn, m.TypeAndAlignment,
			m.ArmorClass, m.HitPoints, m.Speed,
			nullableJSON(m.Abilities),
			nullableJSON(m.Misc),
			nullableJSONArray(m.Actions),
			nullableJSONArray(m.Reactions),
			nullableJSONArray(m.BonusActions),
			nullableJSONArray(m.LegendaryActions),
			nullableJSONArray(m.LairActions),
			nullableJSONArray(m.RegionalEffects),
			nullableJSONArray(m.MythicActions),
		})
	}

	cols := []string{
		"name_ru", "name_en", "type_and_alignment",
		"armor_class", "hit_points", "speed",
		"abilities", "misc", "actions",
		"reactions", "bonus_actions", "legendary_actions",
		"lair_actions", "regional_effects", "mythic_actions",
	}

	n, err := pool.CopyFrom(
		ctx,
		pgx.Identifier{"monsters"},
		cols,
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy monsters: %w", err)
	}

	log.Printf("bestiary: imported %d monsters", n)
	return nil
}

func loadFromDir(dir string) ([]monsterJSON, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read bestiary dir %q: %w", dir, err)
	}

	var monsters []monsterJSON
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			log.Printf("bestiary: skip %s: %v", e.Name(), err)
			continue
		}
		var m monsterJSON
		if err := json.Unmarshal(data, &m); err != nil {
			log.Printf("bestiary: skip %s (parse error): %v", e.Name(), err)
			continue
		}
		if m.NameRu == "" {
			continue
		}
		monsters = append(monsters, m)
	}
	return monsters, nil
}

func nullableJSON(raw json.RawMessage) any {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	return string(raw)
}

func nullableJSONArray(raw json.RawMessage) any {
	if len(raw) == 0 || string(raw) == "null" {
		return "[]"
	}
	return string(raw)
}
