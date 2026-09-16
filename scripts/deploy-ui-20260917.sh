#!/usr/bin/env bash
# Run on the verified LAN host, after uploading a checked frontend bundle.
# Usage: bash deploy-ui-20260917.sh FULL_COMMIT /absolute/path/to/release
set -Eeuo pipefail
umask 077
commit=${1:?full Git commit required}
release=${2:?absolute release directory required}
[[ "$commit" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(hostname)" == 'shenchun-linux' ]] || { echo 'Unexpected host; stopped.'; exit 2; }
repo='/home/shenchun/文档/personal-portal/workdiaryapp/workdiaryapp'
override='/home/shenchun/workdiary-release-20260916/compose.production.json'
[[ "$release" == /home/shenchun/workdiary-ui-release-* && -d "$release/build" ]] || exit 2
[[ "$(realpath "$repo/docker-compose.override.yml")" == "$override" ]] || { echo 'Unexpected production override; stopped.'; exit 2; }
cd "$release"
sha256sum -c SHA256SUMS > bundle-verification.log
[[ -f build/index.html && -f nginx.conf && -f nginx-before.conf ]] || exit 2
cd "$repo"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo 'Tracked source has local changes; stopped.'; exit 2; }
git fetch origin master
git merge-base --is-ancestor HEAD "$commit"
git merge-base --is-ancestor "$commit" origin/master
old_commit=$(git rev-parse HEAD)
old_image=$(docker inspect -f '{{.Image}}' workdiary-frontend)
backend_id=$(docker inspect -f '{{.Id}}' workdiary-backend)
mongo_id=$(docker inspect -f '{{.Id}}' workdiary-mongodb)
pg_id=$(docker inspect -f '{{.Id}}' workdiary-pgvector)
docker cp workdiary-frontend:/etc/nginx/conf.d/default.conf "$release/nginx-current.conf" >/dev/null
cmp "$release/nginx-current.conf" "$release/nginx-before.conf" || { echo 'Deployed nginx differs from checked baseline; inspect before proceeding.'; exit 2; }
short=${commit:0:12}
image="workdiary-release-frontend:ui-$short"
docker tag "$old_image" "workdiary-ui-base:$short"
printf 'FROM workdiary-ui-base:%s\nCOPY build/ /usr/share/nginx/html/\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n' "$short" > "$release/Dockerfile"
docker build --pull=false -t "$image" "$release" > "$release/image-build.log" 2>&1
docker run --rm --entrypoint nginx "$image" -t > "$release/nginx-check.log" 2>&1
backup="/home/shenchun/workdiary-backups/$(date +%Y%m%d-%H%M%S)-before-ui"
mkdir -p "$backup"
cp "$override" "$backup/compose.production.before.json"
printf '%s\n' "$old_commit" > "$backup/source-before.txt"
printf '%s\n' "$old_image" > "$backup/frontend-image-before.txt"
docker inspect workdiary-backend workdiary-frontend workdiary-mongodb workdiary-pgvector > "$backup/containers-private.json"
docker image save "$old_image" | gzip > "$backup/frontend-image.tar.gz"
gzip -t "$backup/frontend-image.tar.gz"
paused=0
switched=0
success=0
cleanup() {
  rc=$?
  if [[ "$paused" == 1 ]]; then docker unpause workdiary-backend >/dev/null || true; fi
  if [[ "$success" != 1 && "$switched" == 1 ]]; then
    cp "$backup/compose.production.before.json" "$override"
    (cd "$repo" && docker compose up -d --no-deps --no-build frontend) > "$release/rollback.log" 2>&1 || true
    echo 'Frontend switch failed; previous override restored. Inspect rollback.log.'
  fi
  exit "$rc"
}
trap cleanup EXIT
# Briefly quiesce application writers while producing a fresh data/files snapshot.
docker pause workdiary-backend >/dev/null
paused=1
docker exec workdiary-mongodb sh -c 'exec mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --oplog' > "$backup/mongodb.archive.gz" 2> "$backup/mongodb-dump.log"
docker exec workdiary-pgvector sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/pgvector.dump"
# docker cp works while the backend is paused and includes persisted private files.
docker cp workdiary-backend:/app/uploads "$backup/uploads" >/dev/null
docker cp workdiary-backend:/app/private "$backup/private" >/dev/null
docker cp workdiary-backend:/app/backup "$backup/backup" >/dev/null
docker cp workdiary-backend:/app/config "$backup/config" >/dev/null
docker unpause workdiary-backend >/dev/null
paused=0
gzip -t "$backup/mongodb.archive.gz"
docker exec -i workdiary-pgvector pg_restore --list < "$backup/pgvector.dump" > "$backup/pgvector-toc.txt"
[[ -s "$backup/pgvector-toc.txt" ]]
(cd "$backup" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS && sha256sum -c SHA256SUMS >/dev/null)
printf 'Verified archive compression, PG table of contents and SHA-256 checksums.\n' > "$backup/BACKUP_COMPLETE"
git merge --ff-only "$commit"
switched=1
python3 - "$override" "$image" <<'PY'
import json,sys,os
path,image=sys.argv[1:]
with open(path) as f: config=json.load(f)
config['services']['frontend']['image']=image
with open(path+'.ui-tmp','w') as f: json.dump(config,f,indent=2)
os.chmod(path+'.ui-tmp',0o600)
os.replace(path+'.ui-tmp',path)
PY
docker compose up -d --no-deps --no-build frontend > "$release/deploy.log" 2>&1
for attempt in $(seq 1 12); do
  if curl -fsS --max-time 5 http://127.0.0.1:13000/login > "$release/served-index.html"; then break; fi
  sleep 2
done
cmp "$release/build/index.html" "$release/served-index.html"
curl -fsS --max-time 10 http://127.0.0.1:5000/ > "$release/backend-health.json"
[[ "$(docker inspect -f '{{.Id}}' workdiary-backend)" == "$backend_id" ]]
[[ "$(docker inspect -f '{{.Id}}' workdiary-mongodb)" == "$mongo_id" ]]
[[ "$(docker inspect -f '{{.Id}}' workdiary-pgvector)" == "$pg_id" ]]
[[ "$(docker inspect -f '{{.Image}}' workdiary-frontend)" == "$(docker image inspect -f '{{.Id}}' "$image")" ]]
cp "$override" "$backup/compose.production.after.json"
printf 'commit=%s\nimage=%s\nbackup=%s\nfinished=%s\n' "$commit" "$image" "$backup" "$(date --iso-8601=seconds)" > "$release/DEPLOYED"
success=1
cat "$release/DEPLOYED"
