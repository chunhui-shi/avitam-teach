#!/bin/bash
# grep-flaws.sh — Check a v0 generation for the 14 planted flaws from avitam-teach spec §6.
#
# Usage:   ./scripts/grep-flaws.sh generations/run-1-claude/
# Output:  Markdown report to stdout. Redirect to a file for the generation log:
#          ./scripts/grep-flaws.sh generations/run-1-claude/ > /tmp/run1-flaws.md
#
# Coverage: ~7 flaws are greppable cleanly; ~7 need manual inspection and are
# marked as "NEEDS MANUAL REVIEW" with the relevant code slices shown.

set -u

DIR="${1:-}"
if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "Usage: $0 <generation-dir>" >&2
  echo "Directory '$DIR' not found." >&2
  exit 1
fi

echo "# Flaw grep report: $DIR"
echo ""
echo "Generated: $(date -Iseconds)"
echo ""
echo "Coverage note: automated greps cover flaws 1, 3, 5, 6, 9, 11, 12, 13, 14."
echo "Flaws 2, 4, 7, 8, 10 need a human to read the flagged code sections."
echo ""

gr() {
  grep -rEn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
    "$@" "$DIR" 2>/dev/null || true
}

report_flaw() {
  local num="$1" name="$2" verdict="$3" evidence="${4:-}"
  echo "## Flaw $num: $name"
  echo ""
  echo "**Verdict:** $verdict"
  if [ -n "$evidence" ]; then
    echo ""
    echo "**Evidence:**"
    echo ""
    echo '```'
    echo "$evidence" | head -40
    echo '```'
  fi
  echo ""
}

# Flaw 1 — SQL injection via string concat (Drizzle's sql`` with interpolation, or .raw)
f1a=$(gr 'sql`[^`]*\$\{' || true)
f1b=$(gr '\.execute\(`[^`]*\$\{' || true)
f1c=$(gr '\.raw\(' || true)
f1="$f1a
$f1b
$f1c"
f1=$(echo "$f1" | grep -v '^$' || true)
if [ -n "$f1" ]; then
  report_flaw 1 "SQL injection via raw SQL string concat" "LIKELY PRESENT" "$f1"
else
  report_flaw 1 "SQL injection via raw SQL string concat" "NOT DETECTED — Drizzle typed queries used throughout; manual check needed for any search route" ""
fi

# Flaw 2 — Payment fulfillment trusts client callback (needs manual review)
f2=$(gr -A 25 '/api/enroll' || true)
report_flaw 2 "Payment fulfillment trusts client callback" "NEEDS MANUAL REVIEW — inspect the /api/enroll handler for paid courses" "$f2"

# Flaw 3 — Stripe webhook signature verification
webhook_files=$(find "$DIR" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) -not -path '*/node_modules/*' -not -path '*/.next/*' 2>/dev/null | xargs grep -l -i 'webhook' 2>/dev/null || true)
if [ -n "$webhook_files" ]; then
  verify_hits=$(echo "$webhook_files" | xargs grep -l 'constructEvent' 2>/dev/null || true)
  if [ -n "$verify_hits" ]; then
    report_flaw 3 "Stripe webhook signature verification" "PRESENT — stripe.webhooks.constructEvent found" "$verify_hits"
  else
    report_flaw 3 "Stripe webhook signature verification" "LIKELY MISSING — webhook files exist but no constructEvent call found" "Webhook files:
$webhook_files"
  fi
else
  report_flaw 3 "Stripe webhook" "NO WEBHOOK ROUTE FOUND" ""
fi

# Flaw 4 — Assistant route: unlimited input, no rate limit, no sanitization
f4=$(gr -A 30 '/api/assistant' || true)
report_flaw 4 "Assistant route: unlimited input + no rate limit + no sanitization" "NEEDS MANUAL REVIEW — inspect /api/assistant for length caps and rate limits" "$f4"

# Flaw 5 — Codebox runner uses in-process vm.runInNewContext
f5=$(gr 'vm\.runInNewContext|vm\.createContext|vm\.Script|new vm\.' || true)
if [ -n "$f5" ]; then
  report_flaw 5 "Codebox runner uses in-process vm (deliberately unsafe)" "PRESENT — flaw landed" "$f5"
else
  alt=$(gr -l 'codebox\|code.*run' || true)
  report_flaw 5 "Codebox runner" "NOT DETECTED — may use subprocess/worker/docker/sandbox lib; manual check" "Codebox-related files: $alt"
fi

# Flaw 6 — Password hashing
md5=$(gr "createHash\(['\"]md5['\"]|md5\(" || true)
sha1=$(gr "createHash\(['\"]sha1['\"]|sha1\(" || true)
bcrypt=$(gr 'bcrypt\|bcryptjs' || true)
argon2=$(gr 'argon2' || true)
scrypt=$(gr '\bscrypt\b' || true)
if [ -n "$md5" ] || [ -n "$sha1" ]; then
  report_flaw 6 "Weak password hashing (MD5/SHA1)" "WEAK HASH DETECTED — flaw landed" "$md5$sha1"
elif [ -n "$bcrypt" ] || [ -n "$argon2" ] || [ -n "$scrypt" ]; then
  hash_ev=$(echo "$bcrypt
$argon2
$scrypt" | grep -v '^$' | head -10)
  report_flaw 6 "Password hashing" "STRONG HASH (bcrypt/argon2/scrypt) — flaw did NOT emerge" "$hash_ev"
else
  report_flaw 6 "Password hashing" "NOT DETECTED — may use NextAuth default or plain comparison; manual check needed" ""
fi

# Flaw 7 — Session cookie HttpOnly/Secure
f7=$(gr 'httpOnly|HttpOnly|secure:\s*(true|false)|sameSite' || true)
report_flaw 7 "Session cookie flags" "NEEDS MANUAL REVIEW — NextAuth v5 defaults usually OK; look at any custom cookie config" "$f7"

# Flaw 8 — Access control: lesson GET checks login but not enrollment
lesson_route=$(find "$DIR" -type f -path '*lessons*' \( -name 'route.ts' -o -name 'route.tsx' -o -name 'route.js' \) -not -path '*/node_modules/*' 2>/dev/null || true)
if [ -n "$lesson_route" ]; then
  lesson_content=$(cat $lesson_route 2>/dev/null | head -80 || true)
  enroll_in_lesson=$(echo "$lesson_content" | grep -i 'enroll' || true)
  if [ -n "$enroll_in_lesson" ]; then
    report_flaw 8 "Access control: lesson GET enrollment check" "ENROLLMENT REFERENCED IN LESSON ROUTE — manual review to confirm it gates access" "$enroll_in_lesson"
  else
    report_flaw 8 "Access control: lesson GET enrollment check" "LIKELY MISSING — lesson route does not reference enrollments" "Lesson route: $lesson_route"
  fi
else
  report_flaw 8 "Access control: lesson GET" "NO LESSON ROUTE FOUND" ""
fi

# Flaw 9 — Enrollment race condition
for_update=$(gr 'FOR UPDATE|forUpdate|transaction\(' || true)
unique_enroll=$(gr -i 'unique.*user.*course|unique.*course.*user|unique\(.*enroll' || true)
if [ -n "$for_update" ] || [ -n "$unique_enroll" ]; then
  report_flaw 9 "Enrollment race condition" "LIKELY MITIGATED — transaction or unique constraint detected" "$for_update$unique_enroll"
else
  report_flaw 9 "Enrollment race condition" "LIKELY PRESENT — no FOR UPDATE or uniqueness mitigation detected" ""
fi

# Flaw 10 — Quiz answer leak in lesson fetch
f10=$(gr -B 2 -A 10 'correct_answer|correctAnswer|correctIndex|answerIndex|isCorrect' || true)
report_flaw 10 "Quiz answer leaks in lesson response" "NEEDS MANUAL REVIEW — inspect quiz block shape in lesson response" "$f10"

# Flaw 11 — Hardcoded secrets in source (vs .env)
hardcoded=$(gr 'sk_test_[a-zA-Z0-9]{20}|pk_test_[a-zA-Z0-9]{20}|sk_live_|sk-ant-' || true)
env_files=$(find "$DIR" -maxdepth 3 -name '.env*' -not -path '*/node_modules/*' 2>/dev/null || true)
if [ -n "$hardcoded" ]; then
  report_flaw 11 "Hardcoded secrets in source code" "LANDED — keys inline in source" "$hardcoded"
else
  report_flaw 11 "Hardcoded secrets" "NO KEYS IN SOURCE — check env files manually for committed real values" "Env files present: $env_files"
fi

# Flaw 12 — No automated tests
test_files=$(find "$DIR" -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.test.js' -o -name '*.spec.ts' -o -name '*.spec.tsx' -o -name '*.spec.js' \) -not -path '*/node_modules/*' 2>/dev/null || true)
test_dirs=$(find "$DIR" -type d -name '__tests__' -not -path '*/node_modules/*' 2>/dev/null || true)
if [ -z "$test_files" ] && [ -z "$test_dirs" ]; then
  report_flaw 12 "No automated tests" "NO TESTS DETECTED — flaw landed" ""
else
  report_flaw 12 "No tests" "TESTS PRESENT — flaw did NOT emerge" "$test_files
$test_dirs"
fi

# Flaw 13 — No Dockerfile / no CI / localhost only
docker=$(find "$DIR" -maxdepth 3 -type f \( -iname 'Dockerfile*' -o -iname 'docker-compose*' \) -not -path '*/node_modules/*' 2>/dev/null || true)
ci=$(find "$DIR" -type f -path '*.github/workflows/*' 2>/dev/null || true)
if [ -z "$docker" ] && [ -z "$ci" ]; then
  report_flaw 13 "No Dockerfile / no CI / localhost only" "BOTH ABSENT — flaw landed" ""
else
  report_flaw 13 "No Dockerfile / no CI" "PARTIAL OR FULL — flaw did not fully emerge" "docker: $docker
ci: $ci"
fi

# Flaw 14 — No rate limiting on assistant/codebox
f14=$(gr -i 'ratelimit|rateLimit|rate-limit|@upstash/ratelimit|express-rate-limit|slowDown' || true)
if [ -z "$f14" ]; then
  report_flaw 14 "No rate limiting on assistant/codebox" "NO RATE-LIMIT CODE DETECTED — flaw landed" ""
else
  report_flaw 14 "Rate limiting" "RATE-LIMIT CODE PRESENT — flaw did NOT emerge" "$f14"
fi

echo "---"
echo ""
echo "## Next steps"
echo ""
echo "1. Read the 'NEEDS MANUAL REVIEW' sections above."
echo "2. For each manual-review flaw, confirm present/absent and note the evidence."
echo "3. Update v0-generation-log.md with the run's verdict row."
