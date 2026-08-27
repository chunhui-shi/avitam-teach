#!/usr/bin/env sh
set -eu
base_url="${1:?usage: smoke-staging.sh https://staging-host}"
health="$(curl --fail --silent --show-error --max-time 15 "$base_url/api/health")"
echo "$health" | grep -q '"status":"ok"'
courses="$(curl --fail --silent --show-error --max-time 15 "$base_url/api/courses")"
echo "$courses" | grep -q '"courses"'
echo "$courses" | grep -q '"slug":"basic-python"'
echo "Staging smoke test passed: health and free Basic Python proof course"
