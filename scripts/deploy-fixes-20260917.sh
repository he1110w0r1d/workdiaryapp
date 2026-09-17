#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
commit=${1:?}; release=${2:?}
[[ "$commit" =~ ^[a-f0-9]{40}$ && "$(hostname)" == shenchun-linux ]] || exit 2
repo='/home/shenchun/文档/personal-portal/workdiaryapp/workdiaryapp'
override='/home/shenchun/workdiary-release-20260916/compose.production.json'
[[ "$release" == /home/shenchun/workdiary-ui-release-* ]] || exit 2
cd "$release"
sha256sum -c SHA256SUMS > bundle-check.log
old=$(docker inspect -f '{{.Image}}' workdiary-backend)
image="workdiary-release-backend:fix-${commit:0:12}"
docker tag "$old" "workdiary-backend-fix-base:${commit:0:12}"
printf 'FROM workdiary-backend-fix-base:%s\nCOPY backend/ /app/\n' "${commit:0:12}" > Dockerfile.backend
docker build --pull=false -f Dockerfile.backend -t "$image" . > backend-build.log 2>&1
docker run --rm --entrypoint node "$image" --check /app/controllers/ragController.js
# Existing frontend rollout first creates and verifies a full data/files backup.
bash "$release/deploy-ui-20260917.sh" "$commit" "$release"
backup=$(sed -n 's/^backup=//p' DEPLOYED)
[[ -f "$backup/BACKUP_COMPLETE" ]] || exit 2
docker image save "$old" | gzip > "$backup/backend-image.tar.gz"
gzip -t "$backup/backend-image.tar.gz"
cp "$override" "$backup/compose.before-backend.json"
cd "$repo"
success=0
rollback() {
 if [[ "$success" != 1 ]]; then
  cp "$backup/compose.before-backend.json" "$override"
  docker compose up -d --no-deps --no-build backend > "$release/backend-rollback.log" 2>&1 || true
 fi
}
trap rollback EXIT
python3 - "$override" "$image" <<'PY'
import json,sys,os
path,image=sys.argv[1:]
with open(path) as f: config=json.load(f)
config['services']['backend']['image']=image
with open(path+'.fix-tmp','w') as f: json.dump(config,f,indent=2)
os.chmod(path+'.fix-tmp',0o600)
os.replace(path+'.fix-tmp',path)
PY
docker compose up -d --no-deps --no-build backend > "$release/backend-deploy.log" 2>&1
healthy=0
for attempt in $(seq 1 20); do
 if curl -fsS --max-time 5 http://127.0.0.1:5000/ > "$release/backend-health.json"; then healthy=1; break; fi
 sleep 2
done
[[ "$healthy" == 1 ]]
[[ "$(docker inspect -f '{{.Image}}' workdiary-backend)" == "$(docker image inspect -f '{{.Id}}' "$image")" ]]
cp "$override" "$backup/compose.after-fixes.json"
(cd "$backup" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS && sha256sum -c SHA256SUMS >/dev/null)
printf 'backend_image=%s\n' "$image" >> "$release/DEPLOYED"
success=1
cat "$release/DEPLOYED"
