#!/bin/sh
# Installs or removes the daily job finder as a launchd job for this Mac user.
#   npm run schedule     install: every day at $HOUR:00, or on wake if the Mac was asleep then
#   npm run unschedule   remove
# Run it from a normal Terminal window: it records where node and claude are, because launchd
# doesn't load your shell's PATH.
set -eu
HOUR="${HOUR:-8}"
LABEL=com.jobautomation.finder
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
WORKER="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="gui/$(id -u)"

if [ "${1:-}" = uninstall ]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed. The job finder won't run on its own any more."
  exit 0
fi

[ -f "$WORKER/.env" ] || { echo "Create worker/.env first (see worker/README.md)."; exit 1; }
NODE_DIR="$(dirname "$(command -v node)")"
CLAUDE_BIN="$(command -v claude || true)"
[ -n "$CLAUDE_BIN" ] || echo "Note: Claude Code wasn't found, so jobs will be scored by keywords only."
mkdir -p "$WORKER/logs" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$WORKER</string>
  <key>ProgramArguments</key>
  <array><string>$NODE_DIR/npm</string><string>start</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$NODE_DIR:/usr/bin:/bin</string>
    <key>CLAUDE_BIN</key><string>$CLAUDE_BIN</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$WORKER/logs/finder.log</string>
  <key>StandardErrorPath</key><string>$WORKER/logs/finder.log</string>
</dict>
</plist>
PLIST_EOF

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
echo "Installed. The job finder runs every day at $HOUR:00."
echo "To run it now as a test:  launchctl kickstart $DOMAIN/$LABEL"
echo "Its output goes to:       $WORKER/logs/finder.log"
