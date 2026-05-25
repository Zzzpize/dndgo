set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_DIR="$PROJECT_DIR/data/backups"
KEEP=10
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="dndgo_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

if [ -f "$PROJECT_DIR/.env" ]; then
    set -o allexport
    source "$PROJECT_DIR/.env"
    set +o allexport
fi

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not set}"

echo "[$(date)] Starting backup → $FILENAME"

docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
    pg_dump -U dndgo dndgo | gzip > "$BACKUP_DIR/$FILENAME"

echo "[$(date)] Backup saved: $BACKUP_DIR/$FILENAME ($(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1))"

EXCESS=$(ls -1t "$BACKUP_DIR"/dndgo_*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)))
if [ -n "$EXCESS" ]; then
    echo "$EXCESS" | xargs rm -f
    echo "[$(date)] Removed old backups, keeping last $KEEP"
fi
