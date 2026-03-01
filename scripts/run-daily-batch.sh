#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# run-daily-batch.sh
# /api/internal/daily-batch/execute を呼び出して日次バッチを実行する
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

for cmd in curl jq; do
	if ! command -v "$cmd" >/dev/null 2>&1; then
		log_error "$cmd が見つかりません。インストールしてください。"
		exit 1
	fi
done

usage() {
	cat <<'USAGE'
Usage: ./scripts/run-daily-batch.sh [OPTIONS]

Options:
  --api-base-url URL   APIのベースURL (default: http://localhost:3001)
  --date YYYY-MM-DD    実行対象日（省略時はAPI側の当日）
  --wait               バッチ完了までステータスをポーリング
  --interval SEC       --wait 時のポーリング間隔秒 (default: 5)
  -h, --help           ヘルプ表示

Examples:
  ./scripts/run-daily-batch.sh
  ./scripts/run-daily-batch.sh --date 2026-03-01
  ./scripts/run-daily-batch.sh --wait --interval 3
USAGE
	exit 0
}

API_BASE_URL="http://localhost:3001"
BATCH_DATE=""
WAIT_FOR_COMPLETION=false
POLL_INTERVAL=5

while [[ $# -gt 0 ]]; do
	case "$1" in
		--api-base-url)
			API_BASE_URL="$2"
			shift 2
			;;
		--date)
			BATCH_DATE="$2"
			shift 2
			;;
		--wait)
			WAIT_FOR_COMPLETION=true
			shift
			;;
		--interval)
			POLL_INTERVAL="$2"
			shift 2
			;;
		-h|--help)
			usage
			;;
		*)
			log_error "不明なオプション: $1"
			usage
			;;
	esac
done

if [[ -n "$BATCH_DATE" && ! "$BATCH_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
	log_error "--date は YYYY-MM-DD 形式で指定してください"
	exit 1
fi

if [[ ! "$POLL_INTERVAL" =~ ^[1-9][0-9]*$ ]]; then
	log_error "--interval は 1 以上の整数で指定してください"
	exit 1
fi

API_BASE_URL="${API_BASE_URL%/}"
EXECUTE_URL="${API_BASE_URL}/api/internal/daily-batch/execute"
STATUS_URL="${API_BASE_URL}/api/internal/daily-batch/status"

HTTP_CODE=""
BODY=""

call_api() {
	local method="$1"
	local url="$2"
	local payload="${3:-}"
	local tmp_file
	tmp_file="$(mktemp)"

	if [[ -n "$payload" ]]; then
		HTTP_CODE="$(curl -sS -o "$tmp_file" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$payload")"
	else
		HTTP_CODE="$(curl -sS -o "$tmp_file" -w "%{http_code}" -X "$method" "$url")"
	fi

	BODY="$(cat "$tmp_file")"
	rm -f "$tmp_file"
}

status_url_with_query() {
	if [[ -n "$BATCH_DATE" ]]; then
		echo "${STATUS_URL}?date=${BATCH_DATE}"
	else
		echo "$STATUS_URL"
	fi
}

format_summary() {
	local json="$1"
	local status
	local total_matches
	local completed
	local failed
	local error_message
	status="$(echo "$json" | jq -r '.data.status // "-"')"
	total_matches="$(echo "$json" | jq -r '.data.total_matches // 0')"
	completed="$(echo "$json" | jq -r '.data.conversations_completed // 0')"
	failed="$(echo "$json" | jq -r '.data.conversations_failed // 0')"
	error_message="$(echo "$json" | jq -r '.data.error_message // empty')"

	echo "status=${status} total_matches=${total_matches} completed=${completed} failed=${failed}${error_message:+ error=\"${error_message}\"}"
}

if [[ -n "$BATCH_DATE" ]]; then
	log_info "日次バッチを実行します: date=${BATCH_DATE}"
	EXECUTE_PAYLOAD="$(jq -n --arg batch_date "$BATCH_DATE" '{batch_date: $batch_date}')"
else
	log_info "日次バッチを実行します: date=APIデフォルト"
	EXECUTE_PAYLOAD="{}"
fi

call_api "POST" "$EXECUTE_URL" "$EXECUTE_PAYLOAD"

if [[ "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]]; then
	log_info "実行リクエスト成功"
	echo "$BODY" | jq .
elif [[ "$HTTP_CODE" == "409" ]]; then
	error_message="$(echo "$BODY" | jq -r '.error.message // "Conflict"' 2>/dev/null || echo "Conflict")"
	log_warn "$error_message"
	if [[ "$WAIT_FOR_COMPLETION" == false ]]; then
		exit 0
	fi
else
	error_message="$(echo "$BODY" | jq -r '.error.message // "Request failed"' 2>/dev/null || echo "Request failed")"
	log_error "実行リクエスト失敗 (HTTP ${HTTP_CODE}): ${error_message}"
	if [[ -n "$BODY" ]]; then
		echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
	fi
	exit 1
fi

if [[ "$WAIT_FOR_COMPLETION" == false ]]; then
	exit 0
fi

log_info "バッチ完了まで待機します（interval=${POLL_INTERVAL}s）"
while true; do
	call_api "GET" "$(status_url_with_query)"

	if [[ "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]]; then
		summary="$(format_summary "$BODY")"
		log_info "$summary"

		status="$(echo "$BODY" | jq -r '.data.status // empty')"
		case "$status" in
			pending|matching|conversations_running)
				sleep "$POLL_INTERVAL"
				;;
			completed)
				log_info "日次バッチが完了しました"
				exit 0
				;;
			failed)
				log_error "日次バッチが失敗しました"
				echo "$BODY" | jq .
				exit 1
				;;
			*)
				log_warn "未知のステータスです: ${status}"
				echo "$BODY" | jq .
				exit 1
				;;
		esac
	elif [[ "$HTTP_CODE" == "404" ]]; then
		log_warn "バッチが見つかりません。リトライします..."
		sleep "$POLL_INTERVAL"
	else
		error_message="$(echo "$BODY" | jq -r '.error.message // "Status request failed"' 2>/dev/null || echo "Status request failed")"
		log_error "ステータス取得失敗 (HTTP ${HTTP_CODE}): ${error_message}"
		if [[ -n "$BODY" ]]; then
			echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
		fi
		exit 1
	fi
done
