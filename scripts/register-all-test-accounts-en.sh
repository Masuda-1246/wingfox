#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# register-all-test-accounts-en.sh
# Register all English test accounts via create-user-with-fox-en.sh
# (40 accounts: 5 presets x 8 users, English nicknames, language=en)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CREATE_USER_SCRIPT="$SCRIPT_DIR/create-user-with-fox-en.sh"
PASSWORD="testpass123"

if [[ ! -x "$CREATE_USER_SCRIPT" ]]; then
  echo "[ERROR] $CREATE_USER_SCRIPT not found or not executable"
  exit 1
fi

# Format: "email nickname gender preset"
ACCOUNTS=(
  # outdoor
  "outdoor-m1-en@test.com Ken male outdoor"
  "outdoor-f1-en@test.com Emma female outdoor"
  "outdoor-m2-en@test.com Alex male outdoor"
  "outdoor-f2-en@test.com Sam female outdoor"
  "outdoor-m3-en@test.com Jake male outdoor"
  "outdoor-f3-en@test.com Lily female outdoor"
  "outdoor-m4-en@test.com Ryan male outdoor"
  "outdoor-f4-en@test.com Zoe female outdoor"
  # indoor
  "indoor-m1-en@test.com Noah male indoor"
  "indoor-f1-en@test.com Ava female indoor"
  "indoor-m2-en@test.com Liam male indoor"
  "indoor-f2-en@test.com Mia female indoor"
  "indoor-m3-en@test.com Ethan male indoor"
  "indoor-f3-en@test.com Ivy female indoor"
  "indoor-m4-en@test.com Owen male indoor"
  "indoor-f4-en@test.com Ruby female indoor"
  # social
  "social-m1-en@test.com Leo male social"
  "social-f1-en@test.com Ella female social"
  "social-m2-en@test.com Max male social"
  "social-f2-en@test.com Grace female social"
  "social-m3-en@test.com Finn male social"
  "social-f3-en@test.com Chloe female social"
  "social-m4-en@test.com Luke male social"
  "social-f4-en@test.com Hazel female social"
  # creative
  "creative-m1-en@test.com Cole male creative"
  "creative-f1-en@test.com Luna female creative"
  "creative-m2-en@test.com Kai male creative"
  "creative-f2-en@test.com Nova female creative"
  "creative-m3-en@test.com Jude male creative"
  "creative-f3-en@test.com Iris female creative"
  "creative-m4-en@test.com Blake male creative"
  "creative-f4-en@test.com Sage female creative"
  # family
  "family-m1-en@test.com Jack male family"
  "family-f1-en@test.com Olivia female family"
  "family-m2-en@test.com James male family"
  "family-f2-en@test.com Sophie female family"
  "family-m3-en@test.com Henry male family"
  "family-f3-en@test.com Charlotte female family"
  "family-m4-en@test.com Oliver male family"
  "family-f4-en@test.com Amelia female family"
)

echo "[INFO] Registering ${#ACCOUNTS[@]} English test accounts (shared password)"
echo ""

for entry in "${ACCOUNTS[@]}"; do
  read -r email nickname gender preset <<< "$entry"
  echo "----------------------------------------"
  echo "[INFO] Registering: $email ($nickname / $gender / $preset)"
  "$CREATE_USER_SCRIPT" \
    --email "$email" \
    --password "${PASSWORD}" \
    --nickname "$nickname" \
    --gender "$gender" \
    --preset "$preset" || {
      echo "[WARN] Registration failed for $email (may already exist). Continuing..."
    }
  echo ""
done

echo "----------------------------------------"
echo "[INFO] All registrations finished"
