#!/usr/bin/env bash
# Claude Code statusLine — pasta · branch · modelo · Context/Session/Week

input=$(cat)

# Cores (interpretadas já na atribuição via $'...')
RESET=$'\033[0m'; DIM=$'\033[2m'
BLUE=$'\033[0;34m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RED=$'\033[0;31m'; CYAN=$'\033[0;36m'

# --- dados do JSON ---
IFS=$'\t' read -r cwd model ctx s_pct s_reset w_pct w_reset < <(
  echo "$input" | jq -r '
    [ (.workspace.current_dir // .cwd),
      (.model.display_name // "?"),
      (.context_window.used_percentage // null),
      (.rate_limits.five_hour.used_percentage // null),
      (.rate_limits.five_hour.resets_at // null),
      (.rate_limits.seven_day.used_percentage // null),
      (.rate_limits.seven_day.resets_at // null)
    ] | map(if . == null then "-" elif type == "number" then (floor | tostring) else tostring end) | @tsv'
)
dir=$(basename "$cwd")

# cor por percentual
pctcolor() { local p=$1; if [ "$p" -ge 80 ]; then printf '%s' "$RED"; elif [ "$p" -ge 50 ]; then printf '%s' "$YELLOW"; else printf '%s' "$GREEN"; fi; }

# tempo até reset -> "1d22h"/"3h23m"/"5m"
# Aceita ISO 8601 (string) ou epoch (segundos = 10 díg., ms = 13 díg.).
reset_human() {
  local ts=$1 now diff secs d h m
  [ -z "$ts" ] || [ "$ts" = "-" ] && return
  now=$(date +%s)
  if [[ "$ts" =~ ^[0-9]{13}$ ]]; then secs=$(( ts / 1000 ))      # epoch ms
  elif [[ "$ts" =~ ^[0-9]{10}$ ]]; then secs=$ts                 # epoch s
  else secs=$(date -d "$ts" +%s 2>/dev/null); fi                # ISO 8601
  [ -z "$secs" ] && return
  diff=$(( secs - now ))
  [ "$diff" -le 0 ] && { printf 'now'; return; }
  d=$((diff/86400)); h=$(((diff%86400)/3600)); m=$(((diff%3600)/60))
  if [ "$d" -gt 0 ]; then printf '%dd%dh' "$d" "$h"
  elif [ "$h" -gt 0 ]; then printf '%dh%dm' "$h" "$m"
  else printf '%dm' "$m"; fi
}

# --- branch via git ---
branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null)

# --- usuário logado (de ~/.claude.json) ---
email=$(jq -r '.oauthAccount.emailAddress // empty' "$HOME/.claude.json" 2>/dev/null)

# --- montar linha ---
line=""
[ -n "$email" ] && line+="${DIM}${email}${RESET} "
line+="${BLUE}${dir}${RESET}"
[ -n "$branch" ] && line+="  ${CYAN}git:(${GREEN}${branch}${CYAN})${RESET}"
line+=" ${DIM}|${RESET} ${DIM}${model}${RESET}"

[ "$ctx" != "-" ] && line+=" ${DIM}|${RESET} ${DIM}Context${RESET} $(pctcolor "$ctx")${ctx}%${RESET}"
if [ "$s_pct" != "-" ]; then
  line+=" ${DIM}· Session${RESET} $(pctcolor "$s_pct")${s_pct}%${RESET}"
  rt=$(reset_human "$s_reset"); [ -n "$rt" ] && line+=" ${DIM}${rt}${RESET}"
fi
if [ "$w_pct" != "-" ]; then
  line+=" ${DIM}· Week${RESET} $(pctcolor "$w_pct")${w_pct}%${RESET}"
  rt=$(reset_human "$w_reset"); [ -n "$rt" ] && line+=" ${DIM}${rt}${RESET}"
fi

printf '%b\n' "$line"
