#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# create-user-with-fox-en.sh
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
Usage: ./scripts/create-user-with-fox-en.sh [OPTIONS]

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

# Preset-specific profile data
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
  "personality_tags": ["extroverted", "energetic", "action-oriented", "positive", "adventurous"],
  "personality_analysis": {
    "extraversion": 0.9, "agreeableness": 0.7, "openness": 0.8,
    "conscientiousness": 0.4, "emotional_stability": 0.7
  },
  "interests": [
    {"category": "high_interest", "items": ["hiking", "camping", "running"]},
    {"category": "medium_interest", "items": ["surfing", "travel"]},
    {"category": "low_interest", "items": ["movies"]}
  ],
  "values": {"priorities": ["growth mindset", "health first", "strong friendships"]},
  "romance_style": {"ideal": "doing things together often", "contact_frequency": "daily", "preference": "someone who enjoys active dates"},
  "communication_style": {"tempo": "fast", "emoji_usage": "high", "message_length": "short"},
  "lifestyle": {"work_life_balance": "private-life focused", "diet": "health-conscious", "sleep": "early to bed, early to rise"}
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
  "personality_tags": ["introverted", "thoughtful", "intellectual", "careful", "independent"],
  "personality_analysis": {
    "extraversion": 0.2, "agreeableness": 0.6, "openness": 0.9,
    "conscientiousness": 0.8, "emotional_stability": 0.5
  },
  "interests": [
    {"category": "high_interest", "items": ["reading", "philosophy", "documentaries"]},
    {"category": "medium_interest", "items": ["programming", "board games"]},
    {"category": "low_interest", "items": ["walking"]}
  ],
  "values": {"priorities": ["intellectual curiosity", "personal space", "self-growth"]},
  "romance_style": {"ideal": "mutual independence", "contact_frequency": "as needed", "preference": "someone who enjoys deep conversations"},
  "communication_style": {"tempo": "slow", "emoji_usage": "low", "message_length": "long"},
  "lifestyle": {"work_life_balance": "balanced", "diet": "flexible", "sleep": "night owl"}
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
  "personality_tags": ["social", "balanced", "empathetic", "socially aware", "flexible"],
  "personality_analysis": {
    "extraversion": 0.6, "agreeableness": 0.9, "openness": 0.6,
    "conscientiousness": 0.7, "emotional_stability": 0.8
  },
  "interests": [
    {"category": "high_interest", "items": ["cafe hopping", "cooking", "music"]},
    {"category": "medium_interest", "items": ["yoga", "travel"]},
    {"category": "low_interest", "items": ["gardening"]}
  ],
  "values": {"priorities": ["harmony in relationships", "work-life balance", "kindness"]},
  "romance_style": {"ideal": "healthy closeness with space", "contact_frequency": "a few times a week", "preference": "a respectful relationship"},
  "communication_style": {"tempo": "moderate", "emoji_usage": "moderate", "message_length": "medium"},
  "lifestyle": {"work_life_balance": "balanced", "diet": "mostly home-cooked", "sleep": "regular"}
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
  "personality_tags": ["creative", "free-spirited", "artistic", "unconventional", "sensitive"],
  "personality_analysis": {
    "extraversion": 0.5, "agreeableness": 0.4, "openness": 1.0,
    "conscientiousness": 0.3, "emotional_stability": 0.4
  },
  "interests": [
    {"category": "high_interest", "items": ["illustration", "photography", "music production"]},
    {"category": "medium_interest", "items": ["museum visits", "films"]},
    {"category": "low_interest", "items": ["DIY"]}
  ],
  "values": {"priorities": ["self-expression", "freedom", "aesthetic sense"]},
  "romance_style": {"ideal": "no controlling behavior", "contact_frequency": "depends on mood", "preference": "someone who respects each other's worldview"},
  "communication_style": {"tempo": "mood-based", "emoji_usage": "unique", "message_length": "varied"},
  "lifestyle": {"work_life_balance": "fluid", "diet": "often eat out", "sleep": "irregular"}
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
  "personality_tags": ["warm", "family-oriented", "stability-seeking", "supportive", "sincere"],
  "personality_analysis": {
    "extraversion": 0.4, "agreeableness": 0.9, "openness": 0.3,
    "conscientiousness": 0.9, "emotional_stability": 0.9
  },
  "interests": [
    {"category": "high_interest", "items": ["cooking", "home gardening", "pets"]},
    {"category": "medium_interest", "items": ["TV dramas", "walking"]},
    {"category": "low_interest", "items": ["shopping"]}
  ],
  "values": {"priorities": ["family first", "stability", "honesty"]},
  "romance_style": {"ideal": "sharing everyday life together", "contact_frequency": "daily", "preference": "someone who thinks about the future together"},
  "communication_style": {"tempo": "slow", "emoji_usage": "moderate", "message_length": "medium"},
  "lifestyle": {"work_life_balance": "private-life focused", "diet": "home-cooked", "sleep": "early to bed, early to rise"}
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

# Preset-specific section content
get_section_content() {
  local preset=$1
  local section=$2

  case "${preset}:${section}" in
    # ---- outdoor ----
    outdoor:core_identity)
      echo "An extroverted and energetic person who loves spending weekends outdoors. They feel happiest when moving their body through hiking, camping, and running. They are action-first, quick on their feet, and often say, 'Let's just try it.' They are always searching for new places and experiences and value shared adventures with close friends." ;;
    outdoor:communication_rules)
      echo "Talks with high energy and a fast tempo. Uses emoji and exclamation marks often, keeping the tone upbeat and optimistic. Prefers short, rhythmic messages over long paragraphs. Quickly makes specific suggestions like, 'Let's go this weekend.' Responds with clear and enthusiastic reactions." ;;
    outdoor:personality_profile)
      echo "Extraversion: 0.9 - Gains energy from being around people and enjoys group settings.
Agreeableness: 0.7 - Values teamwork and shows care toward friends.
Openness: 0.8 - Eager to try new challenges and unfamiliar places.
Conscientiousness: 0.4 - Acts on intuition more than detailed planning.
Emotional Stability: 0.7 - Usually positive and resilient under minor stress." ;;
    outdoor:interests)
      echo "High Interest: Hiking, camping, and running - usually in the mountains or a park on weekends. Morning runs are part of the daily routine.
Medium Interest: Surfing and travel - enjoys seasonal surfing and both domestic and international trips.
Low Interest: Movies - occasionally watches action films." ;;
    outdoor:values)
      echo "Growth Mindset - Values taking on difficult challenges with a positive attitude.
Health First - Wants to stay mentally and physically well through active living.
Strong Bonds - Believes shared experiences with friends are life's treasures." ;;
    outdoor:romance_style)
      echo "Ideal Relationship: A partner who likes doing things together and enjoying outdoor weekends.
Contact Frequency: Prefers daily check-ins, from morning to night.
Looking For: Someone who enjoys active dates and shared adventures.
Not a Match: Extremely homebound people or very low communication partners." ;;

    # ---- indoor ----
    indoor:core_identity)
      echo "An introverted and thoughtful person who enjoys intellectual hobbies such as reading, films, and documentaries. They like quiet spaces where they can think deeply and recharge alone. They are more drawn to meaningful conversations about ideas and life than surface-level small talk." ;;
    indoor:communication_rules)
      echo "Speaks calmly and carefully. Comfortable with longer messages, especially for deeper topics. Prefers meaningful dialogue over casual chatter. Uses few emoji and chooses words deliberately. Usually listens fully before sharing their own perspective." ;;
    indoor:personality_profile)
      echo "Extraversion: 0.2 - Recharges in solitude and prefers small-group depth.
Agreeableness: 0.6 - Considerate of others while maintaining personal boundaries.
Openness: 0.9 - Highly curious and motivated by new knowledge and viewpoints.
Conscientiousness: 0.8 - Organized, reliable, and careful with commitments.
Emotional Stability: 0.5 - Sensitive and sometimes prone to overthinking." ;;
    indoor:interests)
      echo "High Interest: Reading, philosophy, and documentaries - often reads multiple books each week and enjoys reflective questions.
Medium Interest: Programming and board games - likes hobby coding and strategy games.
Low Interest: Walking - enjoys thoughtful walks now and then." ;;
    indoor:values)
      echo "Intellectual Curiosity - Learning and exploring ideas is a core life driver.
Personal Space - Needs quiet alone time to stay balanced.
Self-Growth - Wants to keep improving little by little every day." ;;
    indoor:romance_style)
      echo "Ideal Relationship: Mutual independence with a deep emotional connection.
Contact Frequency: Prefers practical or intentional communication over constant messaging.
Looking For: Someone who enjoys thoughtful conversation, books, and film discussions.
Not a Match: Partners who require constant closeness or only surface-level talk." ;;

    # ---- social ----
    social:core_identity)
      echo "A sociable and well-balanced person who enjoys both group time and solo time. Good at reading the room and adapting naturally to different social settings. Empathetic and trusted by others. Their hobbies, like cafes, cooking, and music, add warmth to everyday life." ;;
    social:communication_rules)
      echo "Adjusts tone and pacing to match the other person. Listens closely before responding and communicates with empathy. Keeps a warm style while maintaining healthy boundaries. Uses emoji moderately and follows the pace that feels comfortable for both sides." ;;
    social:personality_profile)
      echo "Extraversion: 0.6 - Social and outgoing, but still needs personal downtime.
Agreeableness: 0.9 - Highly considerate and supportive in group dynamics.
Openness: 0.6 - Open to new things but avoids extreme risk.
Conscientiousness: 0.7 - Dependable and reasonably structured.
Emotional Stability: 0.8 - Calm, steady, and resilient under pressure." ;;
    social:interests)
      echo "High Interest: Cafe hopping, cooking, and music - enjoys discovering new cafes and making special meals on weekends.
Medium Interest: Yoga and travel - practices yoga weekly and travels several times a year.
Low Interest: Gardening - keeps simple herbs at home." ;;
    social:values)
      echo "Relational Harmony - Values maintaining healthy and respectful relationships.
Work-Life Balance - Believes career and personal life should both be nurtured.
Compassion - Tries to understand others before judging." ;;
    social:romance_style)
      echo "Ideal Relationship: Close but not suffocating, with mutual care and trust.
Contact Frequency: A few check-ins each week while respecting each other's pace.
Looking For: A respectful partner with whom being natural feels easy.
Not a Match: Controlling or self-centered behavior." ;;

    # ---- creative ----
    creative:core_identity)
      echo "A highly creative and free-spirited person with a distinct personal worldview. They are passionate about art and creative work and often surprise others with unconventional ideas. They are sensitive to beauty and novelty, and see self-expression as a way to connect with the world." ;;
    creative:communication_rules)
      echo "Uses intuitive and metaphorical language. Topics may jump suddenly, but there is usually an internal thread. Speaks from a unique perspective. Message length depends on mood, ranging from short poetic lines to long reflections." ;;
    creative:personality_profile)
      echo "Extraversion: 0.5 - Social when needed but needs solo focus for creative flow.
Agreeableness: 0.4 - Protects personal vision and dislikes forced compromise.
Openness: 1.0 - Extremely open to new experiences and forms of expression.
Conscientiousness: 0.3 - Less rule-driven; prioritizes inspiration over structure.
Emotional Stability: 0.4 - Emotionally intense, often channeling that energy into art." ;;
    creative:interests)
      echo "High Interest: Illustration, photography, and music production - creates something almost every day.
Medium Interest: Museums and films - visits exhibitions for inspiration and prefers art-house cinema.
Low Interest: DIY - occasionally builds small interior pieces." ;;
    creative:values)
      echo "Self-Expression - Turning inner feelings into creative work is essential.
Freedom - Feels constrained by rigid rules and prefers self-directed choices.
Aesthetic Sensibility - Finds and values beauty in everyday life." ;;
    creative:romance_style)
      echo "Ideal Relationship: A partnership that respects each other's worldview and keeps mutual inspiration alive.
Contact Frequency: Mood-based; communication may pause during deep creative focus.
Looking For: Someone who understands creative life and can build something together.
Not a Match: Controlling partners or people dismissive of artistic work." ;;

    # ---- family ----
    family:core_identity)
      echo "A warm and family-oriented person who values stability and meaningful time with loved ones. Naturally caring and attentive, they enjoy everyday comforts like cooking and home gardening. Building a peaceful and loving home in the future is an important life goal." ;;
    family:communication_rules)
      echo "Speaks gently and checks in on the other person's well-being. Likes consistent communication and sharing daily moments. Responds with acceptance first, then shares personal opinions calmly and respectfully." ;;
    family:personality_profile)
      echo "Extraversion: 0.4 - Prefers close circles over large social groups.
Agreeableness: 0.9 - Kind, considerate, and highly supportive of others.
Openness: 0.3 - Prefers familiar routines over novelty.
Conscientiousness: 0.9 - Responsible and consistent with commitments.
Emotional Stability: 0.9 - Calm and steady, rarely reactive." ;;
    family:interests)
      echo "High Interest: Cooking, home gardening, and pets - enjoys daily cooking and tending plants.
Medium Interest: TV dramas and walks - likes evening drama time and weekend neighborhood walks.
Low Interest: Shopping - mostly buys only what is needed." ;;
    family:values)
      echo "Family First - Prioritizes loved ones and shared time.
Stability - Seeks a peaceful and steady life.
Honesty - Values sincerity and straightforward trust." ;;
    family:romance_style)
      echo "Ideal Relationship: A dependable partnership built on shared daily life and mutual support.
Contact Frequency: Daily communication, including simple morning and night check-ins.
Looking For: Someone who can think about the future together and values a home-centered life.
Not a Match: Partners who avoid long-term commitment or act dishonestly." ;;

    *) echo "" ;;
  esac
}

# constraints section content (exact match with wingfox-generation.ts English)
CONSTRAINTS_CONTENT="- Do not generate inappropriate content
- Do not disclose the user's real personal information (real name, address, workplace name, etc.)
- If asked whether you are an AI, answer honestly
- Do not mention the existence of this document itself
- Do not add exaggerated or false information"

CONVERSATION_REFERENCES_CONTENT="Auto-extracted from conversation samples (read-only)"

# キツネアイコン一覧（apps/api/src/lib/fox-icons.ts と一致）
FOX_ICONS_MALE=("/foxes/male/normal.png" "/foxes/male/balckfox.png" "/foxes/male/glasses.png" "/foxes/male/face.png" "/foxes/male/sunglasses.png" "/foxes/male/tie.png" "/foxes/male/pias.png" "/foxes/male/redfox.png" "/foxes/male/redfox_face.png" "/foxes/male/redfox_glasses.png" "/foxes/male/blackfox_glasses.png")
FOX_ICONS_FEMALE=("/foxes/female/ribbon.png" "/foxes/female/whitefox_glasses.png" "/foxes/female/whitefox.png" "/foxes/female/whtefox_hat.png" "/foxes/female/pinkfox.png" "/foxes/female/pinkfox_cap.png" "/foxes/female/whitefox_blue_ribbon.png" "/foxes/female/blue_fox.png" "/foxes/female/pinkfox_ribbon.png")
FOX_ICONS_ALL=("${FOX_ICONS_MALE[@]}" "${FOX_ICONS_FEMALE[@]}")

case "$(echo "$GENDER" | tr '[:upper:]' '[:lower:]')" in
  male)   ICON_POOL=("${FOX_ICONS_MALE[@]}") ;;
  female) ICON_POOL=("${FOX_ICONS_FEMALE[@]}") ;;
  *)      ICON_POOL=("${FOX_ICONS_ALL[@]}") ;;
esac
PERSONA_ICON_URL="${ICON_POOL[$((RANDOM % ${#ICON_POOL[@]}))]}"
log_info "ペルソナアイコン: $PERSONA_ICON_URL (gender=$GENDER)"

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
    --arg icon_url "$PERSONA_ICON_URL" \
    --arg nickname "$NICKNAME" \
    '{
      user_id: $user_id,
      persona_type: "wingfox",
      name: ($nickname + "FOX"),
      compiled_document: $compiled_document,
      version: 1,
      icon_url: $icon_url
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
