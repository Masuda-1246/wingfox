#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# register-all-test-accounts.sh
# TEST_ACCOUNTS.md に記載の全テストアカウントを create-user-with-fox.sh で登録する
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CREATE_USER_SCRIPT="$SCRIPT_DIR/create-user-with-fox.sh"
PASSWORD="testpass123"

# 依存スクリプト
if [[ ! -x "$CREATE_USER_SCRIPT" ]]; then
  echo "[ERROR] $CREATE_USER_SCRIPT が見つからないか実行できません"
  exit 1
fi

# アカウント一覧: "email nickname gender preset"
# TEST_ACCOUNTS.md に合わせて 5 preset × 8人 = 40人
ACCOUNTS=(
  # outdoor — アウトドア活発型
  "outdoor-m1@test.com ケンタ male outdoor"
  "outdoor-f1@test.com サクラ female outdoor"
  "outdoor-m2@test.com ユウキ male outdoor"
  "outdoor-f2@test.com ミサキ female outdoor"
  "outdoor-m3@test.com リョウ male outdoor"
  "outdoor-f3@test.com アオイ female outdoor"
  "outdoor-m4@test.com タクミ male outdoor"
  "outdoor-f4@test.com ヒナタ female outdoor"
  # indoor — インドア知的型
  "indoor-m1@test.com シュン male indoor"
  "indoor-f1@test.com シオリ female indoor"
  "indoor-m2@test.com ソウタ male indoor"
  "indoor-f2@test.com ミユ female indoor"
  "indoor-m3@test.com ハルト male indoor"
  "indoor-f3@test.com カナ female indoor"
  "indoor-m4@test.com レン male indoor"
  "indoor-f4@test.com リコ female indoor"
  # social — 社交バランス型
  "social-m1@test.com コウキ male social"
  "social-f1@test.com マイ female social"
  "social-m2@test.com ダイキ male social"
  "social-f2@test.com ユイ female social"
  "social-m3@test.com ナオト male social"
  "social-f3@test.com ナナ female social"
  "social-m4@test.com ショウ male social"
  "social-f4@test.com モモ female social"
  # creative — クリエイティブ自由型
  "creative-m1@test.com ソラ male creative"
  "creative-f1@test.com コトハ female creative"
  "creative-m2@test.com カイト male creative"
  "creative-f2@test.com スズ female creative"
  "creative-m3@test.com ルイ male creative"
  "creative-f3@test.com ミオ female creative"
  "creative-m4@test.com セナ male creative"
  "creative-f4@test.com ルナ female creative"
  # family — 家庭的安定型
  "family-m1@test.com マサト male family"
  "family-f1@test.com アヤカ female family"
  "family-m2@test.com ケイスケ male family"
  "family-f2@test.com ユカリ female family"
  "family-m3@test.com トモヤ male family"
  "family-f3@test.com マナミ female family"
  "family-m4@test.com シンジ male family"
  "family-f4@test.com サトミ female family"
)

echo "[INFO] テストアカウント ${#ACCOUNTS[@]} 件を登録します（共通パスワード: ${PASSWORD}）"
echo ""

for entry in "${ACCOUNTS[@]}"; do
  read -r email nickname gender preset <<< "$entry"
  echo "----------------------------------------"
  echo "[INFO] 登録中: $email ($nickname / $gender / $preset)"
  "$CREATE_USER_SCRIPT" \
    --email "$email" \
    --password "${PASSWORD}" \
    --nickname "$nickname" \
    --gender "$gender" \
    --preset "$preset" || {
      echo "[WARN] $email の登録に失敗しました（既存ユーザーの可能性）。続行します..."
    }
  echo ""
done

echo "----------------------------------------"
echo "[INFO] 全件の登録処理が完了しました"
