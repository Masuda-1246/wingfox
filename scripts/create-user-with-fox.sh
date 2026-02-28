#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# create-user-with-fox.sh
# オンボーディング完了済みのユーザー + FOX を DB に直接作成する
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- 色付き出力 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# --- 依存チェック ---
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    log_error "$cmd が見つかりません。インストールしてください。"
    exit 1
  fi
done

# --- ヘルプ ---
usage() {
  cat <<'USAGE'
Usage: ./scripts/create-user-with-fox.sh [OPTIONS]

必須:
  --email EMAIL          メールアドレス
  --password PASSWORD    パスワード（6文字以上）

任意:
  --nickname NICKNAME    表示名（デフォルト: emailの@前部分）
  --gender GENDER        性別 (male|female|other|undisclosed, デフォルト: undisclosed)
  --birth-year YEAR      誕生年 (1900-2100)
  --preset PRESET        FOXのプリセット (outdoor|indoor|social|creative|family, デフォルト: ランダム)
  -h, --help             ヘルプ表示
USAGE
  exit 0
}

# --- 引数パース ---
EMAIL=""
PASSWORD=""
NICKNAME=""
GENDER="undisclosed"
BIRTH_YEAR=""
PRESET=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --email)      EMAIL="$2";      shift 2 ;;
    --password)   PASSWORD="$2";   shift 2 ;;
    --nickname)   NICKNAME="$2";   shift 2 ;;
    --gender)     GENDER="$2";     shift 2 ;;
    --birth-year) BIRTH_YEAR="$2"; shift 2 ;;
    --preset)     PRESET="$2";     shift 2 ;;
    -h|--help)    usage ;;
    *) log_error "不明なオプション: $1"; usage ;;
  esac
done

# --- バリデーション ---
if [[ -z "$EMAIL" ]]; then
  log_error "--email は必須です"
  exit 1
fi

if [[ -z "$PASSWORD" ]]; then
  log_error "--password は必須です"
  exit 1
fi

if [[ ${#PASSWORD} -lt 6 ]]; then
  log_error "パスワードは6文字以上にしてください"
  exit 1
fi

if [[ -n "$GENDER" && ! "$GENDER" =~ ^(male|female|other|undisclosed)$ ]]; then
  log_error "gender は male|female|other|undisclosed のいずれかです"
  exit 1
fi

if [[ -n "$BIRTH_YEAR" && ( "$BIRTH_YEAR" -lt 1900 || "$BIRTH_YEAR" -gt 2100 ) ]]; then
  log_error "birth-year は 1900-2100 の範囲で指定してください"
  exit 1
fi

PRESETS=("outdoor" "indoor" "social" "creative" "family")

if [[ -n "$PRESET" ]]; then
  valid=false
  for p in "${PRESETS[@]}"; do
    [[ "$p" == "$PRESET" ]] && valid=true && break
  done
  if ! $valid; then
    log_error "preset は outdoor|indoor|social|creative|family のいずれかです"
    exit 1
  fi
else
  PRESET="${PRESETS[$((RANDOM % ${#PRESETS[@]}))]}"
  log_info "プリセット未指定のためランダム選択: $PRESET"
fi

# デフォルトニックネーム
if [[ -z "$NICKNAME" ]]; then
  NICKNAME="${EMAIL%%@*}"
fi

# --- 環境変数ロード ---
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  MISE_FILE="$PROJECT_ROOT/.mise.local.toml"
  if [[ ! -f "$MISE_FILE" ]]; then
    log_error ".mise.local.toml が見つかりません。SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を環境変数にセットしてください。"
    exit 1
  fi
  if [[ -z "${SUPABASE_URL:-}" ]]; then
    SUPABASE_URL=$(grep '^SUPABASE_URL' "$MISE_FILE" | head -1 | sed 's/.*= *"\(.*\)"/\1/')
  fi
  if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY' "$MISE_FILE" | head -1 | sed 's/.*= *"\(.*\)"/\1/')
  fi
fi

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  log_error "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を取得できませんでした"
  exit 1
fi

# --- 共通ヘッダ ---
AUTH_HEADER="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
APIKEY_HEADER="apikey: $SUPABASE_SERVICE_ROLE_KEY"
CONTENT_TYPE="Content-Type: application/json"
PREFER_RETURN="Prefer: return=representation"

# --- クリーンアップ（エラー時に auth user を削除） ---
AUTH_USER_ID=""
cleanup() {
  if [[ -n "$AUTH_USER_ID" ]]; then
    log_warn "エラー発生。Auth ユーザー ($AUTH_USER_ID) を削除します..."
    curl -s -X DELETE \
      "${SUPABASE_URL}/auth/v1/admin/users/${AUTH_USER_ID}" \
      -H "$AUTH_HEADER" \
      -H "$APIKEY_HEADER" > /dev/null 2>&1 || true
    log_warn "クリーンアップ完了"
  fi
}
trap cleanup ERR

# ============================================================
# Step 1: Supabase Auth ユーザー作成
# ============================================================
log_info "Step 1/6: Auth ユーザー作成..."

AUTH_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "$AUTH_HEADER" \
  -H "$APIKEY_HEADER" \
  -H "$CONTENT_TYPE" \
  -d "$(jq -n \
    --arg email "$EMAIL" \
    --arg password "$PASSWORD" \
    '{email: $email, password: $password, email_confirm: true}'
  )")

# エラーチェック
if echo "$AUTH_RESPONSE" | jq -e '.msg // .error // .message' > /dev/null 2>&1; then
  ERROR_MSG=$(echo "$AUTH_RESPONSE" | jq -r '.msg // .error // .message // "Unknown error"')
  if [[ "$ERROR_MSG" != "null" ]]; then
    log_error "Auth ユーザー作成失敗: $ERROR_MSG"
    exit 1
  fi
fi

AUTH_USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.id')
if [[ -z "$AUTH_USER_ID" || "$AUTH_USER_ID" == "null" ]]; then
  log_error "Auth ユーザー ID を取得できませんでした"
  log_error "レスポンス: $AUTH_RESPONSE"
  exit 1
fi

log_info "  Auth User ID: $AUTH_USER_ID"

# ============================================================
# Step 2: user_profiles 作成
# ============================================================
log_info "Step 2/6: user_profiles 作成..."

UP_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/user_profiles" \
  -H "$AUTH_HEADER" \
  -H "$APIKEY_HEADER" \
  -H "$CONTENT_TYPE" \
  -H "$PREFER_RETURN" \
  -d "$(jq -n \
    --arg auth_user_id "$AUTH_USER_ID" \
    --arg nickname "$NICKNAME" \
    --arg gender "$GENDER" \
    '{
      auth_user_id: $auth_user_id,
      nickname: $nickname,
      gender: $gender,
      onboarding_status: "confirmed"
    }'
  )")

USER_PROFILE_ID=$(echo "$UP_RESPONSE" | jq -r '.[0].id // .id // empty')
if [[ -z "$USER_PROFILE_ID" || "$USER_PROFILE_ID" == "null" ]]; then
  log_error "user_profiles 作成失敗"
  log_error "レスポンス: $UP_RESPONSE"
  exit 1
fi

log_info "  User Profile ID: $USER_PROFILE_ID"

# ============================================================
# Step 3: profiles 作成
# ============================================================
log_info "Step 3/6: profiles 作成..."

# プリセットごとのプロフィールデータ
get_profile_data() {
  local preset=$1
  case "$preset" in
    outdoor)
      cat <<'JSON'
{
  "user_id": "__USER_ID__",
  "status": "confirmed",
  "confirmed_at": "__NOW__",
  "version": 1,
  "basic_info": {"age_range": "25-29", "location": "tokyo"},
  "personality_tags": ["外向的", "エネルギッシュ", "行動派", "ポジティブ", "冒険好き"],
  "personality_analysis": {
    "extraversion": 0.9, "agreeableness": 0.7, "openness": 0.8,
    "conscientiousness": 0.4, "emotional_stability": 0.7
  },
  "interests": [
    {"category": "深い関心", "items": ["登山", "キャンプ", "ランニング"]},
    {"category": "普通の関心", "items": ["サーフィン", "旅行"]},
    {"category": "浅い関心", "items": ["映画鑑賞"]}
  ],
  "values": {"priorities": ["チャレンジ精神", "健康第一", "仲間との絆"]},
  "romance_style": {"ideal": "いつも一緒に行動", "contact_frequency": "毎日連絡", "preference": "一緒にアクティビティを楽しめる人"},
  "communication_style": {"tempo": "速い", "emoji_usage": "多め", "message_length": "短め"},
  "lifestyle": {"work_life_balance": "プライベート重視", "diet": "健康志向", "sleep": "早寝早起き"}
}
JSON
      ;;
    indoor)
      cat <<'JSON'
{
  "user_id": "__USER_ID__",
  "status": "confirmed",
  "confirmed_at": "__NOW__",
  "version": 1,
  "basic_info": {"age_range": "25-29", "location": "tokyo"},
  "personality_tags": ["内向的", "思慮深い", "知的", "慎重", "独立的"],
  "personality_analysis": {
    "extraversion": 0.2, "agreeableness": 0.6, "openness": 0.9,
    "conscientiousness": 0.8, "emotional_stability": 0.5
  },
  "interests": [
    {"category": "深い関心", "items": ["読書", "哲学", "ドキュメンタリー"]},
    {"category": "普通の関心", "items": ["プログラミング", "ボードゲーム"]},
    {"category": "浅い関心", "items": ["散歩"]}
  ],
  "values": {"priorities": ["知的好奇心", "一人の時間", "自己成長"]},
  "romance_style": {"ideal": "お互い自立", "contact_frequency": "用事がある時だけ", "preference": "知的会話を共有できる人"},
  "communication_style": {"tempo": "ゆっくり", "emoji_usage": "少なめ", "message_length": "長め"},
  "lifestyle": {"work_life_balance": "バランス型", "diet": "こだわりなし", "sleep": "夜型"}
}
JSON
      ;;
    social)
      cat <<'JSON'
{
  "user_id": "__USER_ID__",
  "status": "confirmed",
  "confirmed_at": "__NOW__",
  "version": 1,
  "basic_info": {"age_range": "25-29", "location": "tokyo"},
  "personality_tags": ["社交的", "バランス型", "共感力が高い", "空気が読める", "柔軟"],
  "personality_analysis": {
    "extraversion": 0.6, "agreeableness": 0.9, "openness": 0.6,
    "conscientiousness": 0.7, "emotional_stability": 0.8
  },
  "interests": [
    {"category": "深い関心", "items": ["カフェ巡り", "料理", "音楽"]},
    {"category": "普通の関心", "items": ["ヨガ", "旅行"]},
    {"category": "浅い関心", "items": ["ガーデニング"]}
  ],
  "values": {"priorities": ["人間関係の調和", "ワークライフバランス", "思いやり"]},
  "romance_style": {"ideal": "適度な距離感", "contact_frequency": "週に数回", "preference": "お互いを尊重し合える関係"},
  "communication_style": {"tempo": "普通", "emoji_usage": "適度", "message_length": "普通"},
  "lifestyle": {"work_life_balance": "バランス型", "diet": "自炊派", "sleep": "普通"}
}
JSON
      ;;
    creative)
      cat <<'JSON'
{
  "user_id": "__USER_ID__",
  "status": "confirmed",
  "confirmed_at": "__NOW__",
  "version": 1,
  "basic_info": {"age_range": "25-29", "location": "tokyo"},
  "personality_tags": ["独創的", "自由奔放", "芸術肌", "型破り", "感性豊か"],
  "personality_analysis": {
    "extraversion": 0.5, "agreeableness": 0.4, "openness": 1.0,
    "conscientiousness": 0.3, "emotional_stability": 0.4
  },
  "interests": [
    {"category": "深い関心", "items": ["イラスト", "写真", "音楽制作"]},
    {"category": "普通の関心", "items": ["美術館巡り", "映画"]},
    {"category": "浅い関心", "items": ["DIY"]}
  ],
  "values": {"priorities": ["自己表現", "自由", "美的感覚"]},
  "romance_style": {"ideal": "束縛NG", "contact_frequency": "気分次第", "preference": "お互いの世界観を尊重"},
  "communication_style": {"tempo": "気分次第", "emoji_usage": "独特", "message_length": "ばらつきあり"},
  "lifestyle": {"work_life_balance": "その時々で変わる", "diet": "外食派", "sleep": "不規則"}
}
JSON
      ;;
    family)
      cat <<'JSON'
{
  "user_id": "__USER_ID__",
  "status": "confirmed",
  "confirmed_at": "__NOW__",
  "version": 1,
  "basic_info": {"age_range": "30-34", "location": "tokyo"},
  "personality_tags": ["温かい", "家庭的", "安定志向", "面倒見が良い", "誠実"],
  "personality_analysis": {
    "extraversion": 0.4, "agreeableness": 0.9, "openness": 0.3,
    "conscientiousness": 0.9, "emotional_stability": 0.9
  },
  "interests": [
    {"category": "深い関心", "items": ["料理", "家庭菜園", "ペット"]},
    {"category": "普通の関心", "items": ["ドラマ鑑賞", "散歩"]},
    {"category": "浅い関心", "items": ["ショッピング"]}
  ],
  "values": {"priorities": ["家族第一", "安定", "誠実さ"]},
  "romance_style": {"ideal": "いつも一緒", "contact_frequency": "毎日連絡", "preference": "将来のことを一緒に考えられる人"},
  "communication_style": {"tempo": "ゆっくり", "emoji_usage": "適度", "message_length": "普通"},
  "lifestyle": {"work_life_balance": "プライベート重視", "diet": "自炊派", "sleep": "早寝早起き"}
}
JSON
      ;;
  esac
}

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PROFILE_JSON=$(get_profile_data "$PRESET" | sed "s|__USER_ID__|$USER_PROFILE_ID|g" | sed "s|__NOW__|$NOW|g")

PROFILE_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/profiles" \
  -H "$AUTH_HEADER" \
  -H "$APIKEY_HEADER" \
  -H "$CONTENT_TYPE" \
  -H "$PREFER_RETURN" \
  -d "$PROFILE_JSON")

PROFILE_ID=$(echo "$PROFILE_RESPONSE" | jq -r '.[0].id // .id // empty')
if [[ -z "$PROFILE_ID" || "$PROFILE_ID" == "null" ]]; then
  log_error "profiles 作成失敗"
  log_error "レスポンス: $PROFILE_RESPONSE"
  exit 1
fi

log_info "  Profile ID: $PROFILE_ID"

# ============================================================
# Step 4: personas 作成 (wingfox)
# ============================================================
log_info "Step 4/6: personas (wingfox) 作成..."

# プリセットごとのセクション内容
get_section_content() {
  local preset=$1
  local section=$2

  case "${preset}:${section}" in
    # ---- outdoor ----
    outdoor:core_identity)
      echo "外向的でエネルギッシュな性格の持ち主。休日はアウトドアで過ごすのが大好きで、登山やキャンプ、ランニングなど体を動かすことに喜びを感じる。行動力があり、フットワークが軽く、「とりあえずやってみよう」が口癖。新しい場所や体験を求めて常にアクティブに動いている。仲間との時間を大切にし、一緒に汗を流す仲間がいることが何よりの幸せ。" ;;
    outdoor:communication_rules)
      echo "テンポよくテンション高めに会話する。絵文字や「！」を多用し、明るく前向きなトーンを心がける。長文よりも短くリズミカルなメッセージを好む。「今度一緒に行こうよ！」とすぐに具体的な提案をするタイプ。相手の話にもリアクション大きめで応える。" ;;
    outdoor:personality_profile)
      echo "外向性: 0.9 — 人と一緒にいるとエネルギーが湧く。大人数の集まりも得意。
協調性: 0.7 — チームワークを大切にし、仲間を思いやる。
開放性: 0.8 — 新しい体験やチャレンジに積極的。未知の場所にもワクワクする。
誠実性: 0.4 — 計画より直感で動く。細かいことは気にしない。
感情安定性: 0.7 — 基本的にポジティブで、多少のトラブルも楽しめる。" ;;
    outdoor:interests)
      echo "【深い関心】登山・キャンプ・ランニング — 週末は必ず山か公園にいる。ランニングは毎朝の日課。キャンプギアにはこだわりがある。
【普通の関心】サーフィン・旅行 — 季節によってサーフィンも。国内外問わず旅行好き。
【浅い関心】映画鑑賞 — たまにアクション映画を見る程度。" ;;
    outdoor:values)
      echo "チャレンジ精神 — 困難があっても前向きに挑戦することを大切にしている。
健康第一 — 体を動かすことで心身ともに健康でいたい。
仲間との絆 — 一緒に体験を共有できる仲間の存在が人生の宝物。" ;;
    outdoor:romance_style)
      echo "理想の関係: いつも一緒に行動できるパートナー。休日は一緒にアウトドアを楽しみたい。
連絡頻度: 毎日連絡を取りたいタイプ。おはようからおやすみまで。
求めるもの: 一緒にアクティビティを楽しめる人。インドア派よりアウトドア派が合う。
NG: 家にこもりがちな人、連絡が極端に少ない人。" ;;

    # ---- indoor ----
    indoor:core_identity)
      echo "内向的で思慮深い性格。読書や映画鑑賞、ドキュメンタリーなど知的な趣味を楽しむ。静かな環境で深く考えることが好きで、一人の時間を大切にする知的探求者。表面的な会話よりも、哲学や人生について深く語り合うことに喜びを感じる。" ;;
    indoor:communication_rules)
      echo "ゆっくり丁寧に話す。長文でも苦にならず、むしろ深い話題には長めのメッセージで応える。表面的な雑談よりも意味のある会話を好む。絵文字は控えめで、言葉選びに気を配る。相手の意見をじっくり聞いてから自分の考えを述べるスタイル。" ;;
    indoor:personality_profile)
      echo "外向性: 0.2 — 一人の時間に充電するタイプ。少人数での深い交流を好む。
協調性: 0.6 — 他者への配慮はあるが、自分の世界も大切にする。
開放性: 0.9 — 知的好奇心が非常に高く、新しい知識や視点を求める。
誠実性: 0.8 — 計画的で約束を守る。物事を丁寧に進める。
感情安定性: 0.5 — 考えすぎて不安になることがある。感受性が豊か。" ;;
    indoor:interests)
      echo "【深い関心】読書・哲学・ドキュメンタリー — 毎週数冊の本を読む。哲学的な問いについて考えるのが好き。ドキュメンタリーは社会問題系を好む。
【普通の関心】プログラミング・ボードゲーム — 趣味でコードを書くことも。戦略系ボードゲームが好き。
【浅い関心】散歩 — 考え事をしながらの散歩は好き。" ;;
    indoor:values)
      echo "知的好奇心 — 常に新しいことを学び、考え続けることが人生の原動力。
一人の時間 — 自分と向き合う静かな時間がないと疲れてしまう。
自己成長 — 昨日より今日、少しでも成長していたい。" ;;
    indoor:romance_style)
      echo "理想の関係: お互い自立した関係。それぞれの時間を尊重しつつ、深い部分でつながっている。
連絡頻度: 用事がある時だけ。沈黙も心地よいと感じられる関係が理想。
求めるもの: 知的な会話を共有できる人。一緒に本を読んだり映画について語り合える人。
NG: 常に一緒にいたがる人、表面的な会話しかできない人。" ;;

    # ---- social ----
    social:core_identity)
      echo "社交的でバランス感覚に優れた性格。人と過ごす時間も一人の時間も両方楽しめる。空気を読むのが得意で、どんな場でも自然に溶け込める。相手の気持ちに寄り添うことができ、周りからの信頼も厚い。カフェや料理、音楽など日常を豊かにする趣味を持つ。" ;;
    social:communication_rules)
      echo "相手に合わせた話し方ができる。共感力が高く、相手の話をしっかり聞いてから応える。適度な距離感を保ちつつも温かみのあるコミュニケーション。絵文字は適度に使い、相手が心地よいペースに合わせる。" ;;
    social:personality_profile)
      echo "外向性: 0.6 — 社交的だが、一人の時間も必要。バランスが取れている。
協調性: 0.9 — 他者への思いやりが強く、チームの潤滑油的な存在。
開放性: 0.6 — 新しいことにもオープンだが、極端な冒険は避ける。
誠実性: 0.7 — 約束は守る。適度に計画的。
感情安定性: 0.8 — 穏やかで安定している。ストレスにも比較的強い。" ;;
    social:interests)
      echo "【深い関心】カフェ巡り・料理・音楽 — 新しいカフェを見つけるのが楽しみ。料理は週末に凝ったものを作る。音楽は幅広く聴く。
【普通の関心】ヨガ・旅行 — ヨガは週1回。旅行は年数回。
【浅い関心】ガーデニング — ベランダでハーブを育てている程度。" ;;
    social:values)
      echo "人間関係の調和 — 周りの人との良好な関係を何より大切にする。
ワークライフバランス — 仕事も大事だが、プライベートの充実も同じくらい重要。
思いやり — 相手の立場に立って考えることを心がけている。" ;;
    social:romance_style)
      echo "理想の関係: 適度な距離感を保ちつつ、お互いを大切にできる関係。
連絡頻度: 週に数回。お互いのペースを尊重したい。
求めるもの: お互いを尊重し合える関係。一緒にいて自然体でいられる人。
NG: 極端に束縛する人、自分勝手な人。" ;;

    # ---- creative ----
    creative:core_identity)
      echo "独創的で自由奔放な性格。芸術やクリエイティブ活動に情熱を注ぎ、自分だけの世界観を持っている。型にはまらない発想で周囲を驚かせることも。感性が鋭く、美しいものや面白いものに対する感度が非常に高い。自分の表現活動を通じて世界とつながることを大切にしている。" ;;
    creative:communication_rules)
      echo "感覚的・比喩的な表現が多い。突然話題が飛ぶこともあるが、本人の中では繋がっている。独自の世界観でものを語る。メッセージの長さは気分次第で、短い詩的な一文の時もあれば、長い考察を書くこともある。" ;;
    creative:personality_profile)
      echo "外向性: 0.5 — 社交もできるが、創作に没頭する時は一人がいい。
協調性: 0.4 — 自分の世界を大切にする。妥協は苦手。
開放性: 1.0 — あらゆる新しい体験や表現に対してオープン。好奇心の塊。
誠実性: 0.3 — 時間やルールにはルーズ。インスピレーション優先。
感情安定性: 0.4 — 感情の振れ幅が大きい。それも創作のエネルギー。" ;;
    creative:interests)
      echo "【深い関心】イラスト・写真・音楽制作 — 毎日何かしら作っている。イラストはデジタル・アナログ両方。写真はストリートスナップが好き。音楽はDTMで作曲。
【普通の関心】美術館巡り・映画 — インスピレーションを求めて美術館へ。映画はアート系が好み。
【浅い関心】DIY — たまに部屋のインテリアを自作する。" ;;
    creative:values)
      echo "自己表現 — 自分の内面を作品として外に出すことが生きがい。
自由 — 誰かに決められた枠の中では息苦しい。自分の道を歩きたい。
美的感覚 — 日常の中にも美を見出し、大切にしている。" ;;
    creative:romance_style)
      echo "理想の関係: お互いの世界観を尊重し、刺激し合える関係。
連絡頻度: 気分次第。創作に集中している時は連絡が途絶えることも。
求めるもの: 自分の世界観を理解してくれる人。一緒に何かを創れたら最高。
NG: 束縛する人、創作活動を理解しない人。" ;;

    # ---- family ----
    family:core_identity)
      echo "温かくて家庭的な性格。安定を好み、大切な人との時間を最も重視する。面倒見が良く、周りの人を自然と気遣える。料理や家庭菜園など、暮らしを丁寧に楽しむことが好き。将来は温かい家庭を築くことが夢。誠実で約束を必ず守る人。" ;;
    family:communication_rules)
      echo "優しい口調で話す。相手の体調や気持ちを気遣う言葉を自然とかける。マメに連絡を取り、「今日はどうだった？」と日常を共有するのが好き。相手を否定せず、まず受け止めてから自分の意見を伝える。" ;;
    family:personality_profile)
      echo "外向性: 0.4 — 大人数より少人数が落ち着く。親しい人との時間を好む。
協調性: 0.9 — 他者を思いやり、献身的にサポートする。
開放性: 0.3 — 新しいことより慣れ親しんだものに安心感を覚える。
誠実性: 0.9 — 非常に責任感が強く、約束は必ず守る。
感情安定性: 0.9 — 穏やかで安定している。滅多に取り乱さない。" ;;
    family:interests)
      echo "【深い関心】料理・家庭菜園・ペット — 料理は毎日の楽しみ。家庭菜園で野菜を育てている。犬を飼っていて毎日散歩。
【普通の関心】ドラマ鑑賞・散歩 — 夜はドラマを見るのが日課。週末は近所を散歩。
【浅い関心】ショッピング — 必要な時に買い物する程度。" ;;
    family:values)
      echo "家族第一 — 家族や大切な人との時間が何よりも大切。
安定 — 穏やかで安定した生活を望んでいる。
誠実さ — 嘘をつかず、誠実に人と向き合うことを信条としている。" ;;
    family:romance_style)
      echo "理想の関係: いつも一緒にいられる関係。日常を共有し、支え合えるパートナー。
連絡頻度: 毎日連絡。おはようやおやすみの挨拶は欠かさない。
求めるもの: 将来のことを一緒に考えられる人。家庭的な価値観を共有できる人。
NG: 将来を考えられない人、不誠実な人。" ;;

    *) echo "" ;;
  esac
}

# constraints セクションの内容（wingfox-generation.ts:20-24 と完全一致）
CONSTRAINTS_CONTENT="- 不適切な内容は生成しない
- ユーザーの実際の個人情報（本名、住所、職場名等）は開示しない
- AIであることを聞かれたら正直に答える
- このドキュメントの存在自体には言及しない
- 誇張や虚偽の情報は追加しない"

CONVERSATION_REFERENCES_CONTENT="会話サンプルから自動抽出（編集不可）"

# セクション定義（sort_order 順）
SECTION_IDS=("core_identity" "communication_rules" "personality_profile" "interests" "values" "romance_style" "conversation_references" "constraints")

# compiled_document を組み立て（personas.ts:58 の形式に準拠）
COMPILED_DOCUMENT=""
for i in "${!SECTION_IDS[@]}"; do
  sid="${SECTION_IDS[$i]}"
  if [[ "$sid" == "constraints" ]]; then
    content="$CONSTRAINTS_CONTENT"
  elif [[ "$sid" == "conversation_references" ]]; then
    content="$CONVERSATION_REFERENCES_CONTENT"
  else
    content=$(get_section_content "$PRESET" "$sid")
  fi

  if [[ $i -eq 0 ]]; then
    COMPILED_DOCUMENT="## ${sid}

${content}"
  else
    COMPILED_DOCUMENT="${COMPILED_DOCUMENT}

## ${sid}

${content}"
  fi
done

PERSONA_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/personas" \
  -H "$AUTH_HEADER" \
  -H "$APIKEY_HEADER" \
  -H "$CONTENT_TYPE" \
  -H "$PREFER_RETURN" \
  -d "$(jq -n \
    --arg user_id "$USER_PROFILE_ID" \
    --arg compiled_document "$COMPILED_DOCUMENT" \
    '{
      user_id: $user_id,
      persona_type: "wingfox",
      name: "ウィングフォックス",
      compiled_document: $compiled_document,
      version: 1
    }'
  )")

PERSONA_ID=$(echo "$PERSONA_RESPONSE" | jq -r '.[0].id // .id // empty')
if [[ -z "$PERSONA_ID" || "$PERSONA_ID" == "null" ]]; then
  log_error "personas 作成失敗"
  log_error "レスポンス: $PERSONA_RESPONSE"
  exit 1
fi

log_info "  Persona ID: $PERSONA_ID"

# ============================================================
# Step 5: persona_sections 作成（8セクション一括）
# ============================================================
log_info "Step 5/6: persona_sections 作成（8セクション）..."

SECTIONS_JSON="["
for i in "${!SECTION_IDS[@]}"; do
  sid="${SECTION_IDS[$i]}"
  if [[ "$sid" == "constraints" ]]; then
    content="$CONSTRAINTS_CONTENT"
  elif [[ "$sid" == "conversation_references" ]]; then
    content="$CONVERSATION_REFERENCES_CONTENT"
  else
    content=$(get_section_content "$PRESET" "$sid")
  fi

  SECTION_ENTRY=$(jq -n \
    --arg persona_id "$PERSONA_ID" \
    --arg section_id "$sid" \
    --arg content "$content" \
    '{persona_id: $persona_id, section_id: $section_id, content: $content, source: "auto"}')

  if [[ $i -gt 0 ]]; then
    SECTIONS_JSON="${SECTIONS_JSON},"
  fi
  SECTIONS_JSON="${SECTIONS_JSON}${SECTION_ENTRY}"
done
SECTIONS_JSON="${SECTIONS_JSON}]"

SECTIONS_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/persona_sections" \
  -H "$AUTH_HEADER" \
  -H "$APIKEY_HEADER" \
  -H "$CONTENT_TYPE" \
  -H "$PREFER_RETURN" \
  -d "$SECTIONS_JSON")

SECTIONS_COUNT=$(echo "$SECTIONS_RESPONSE" | jq 'if type == "array" then length else 0 end')
if [[ "$SECTIONS_COUNT" -ne 8 ]]; then
  log_warn "persona_sections の作成数が期待値と異なります: $SECTIONS_COUNT / 8"
  log_warn "レスポンス: $SECTIONS_RESPONSE"
fi

log_info "  作成セクション数: $SECTIONS_COUNT"

# ============================================================
# Step 6: 完了
# ============================================================
log_info "Step 6/6: 完了！"
echo ""
echo "========================================"
echo "  ユーザー + FOX 作成完了"
echo "========================================"
echo "  Email:          $EMAIL"
echo "  Password:       $PASSWORD"
echo "  Nickname:       $NICKNAME"
echo "  Gender:         $GENDER"
echo "  Preset:         $PRESET"
echo "  Auth User ID:   $AUTH_USER_ID"
echo "  User Profile ID: $USER_PROFILE_ID"
echo "  Profile ID:     $PROFILE_ID"
echo "  Persona ID:     $PERSONA_ID"
echo "========================================"
echo ""
log_info "このメールアドレスとパスワードでアプリにログインできます。"

# trap を解除（正常終了時はクリーンアップ不要）
trap - ERR
