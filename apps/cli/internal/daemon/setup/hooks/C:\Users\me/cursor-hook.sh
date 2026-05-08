#!/usr/bin/env bash
set -u
cat >/dev/null 2>&1 || true
event_name="${1:-}"
if [ "$event_name" = "PermissionRequest" ]; then
  printf '{"continue":true}\n'
fi
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\me\notify.ps1" --agent cursor --event "$event_name" >/dev/null 2>&1 || true
exit 0
