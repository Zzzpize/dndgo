SELECT COUNT(*) FROM monsters;

SELECT id, name_ru, name_en, type_and_alignment, armor_class, hit_points, speed
FROM monsters
ORDER BY name_ru
LIMIT $1 OFFSET $2;

SELECT * FROM monsters WHERE id = $1;

SELECT id, name_ru, name_en, type_and_alignment, armor_class, hit_points, speed
FROM monsters
WHERE search_vector @@ plainto_tsquery('russian', $1)
ORDER BY ts_rank(search_vector, plainto_tsquery('russian', $1)) DESC
LIMIT $2 OFFSET $3;
