#!/bin/sh
# Installs or removes the daily job finder as launchd jobs for this Mac user.
#   npm run schedule     install: every day at 8:00, 13:00 and 18:00 (change with HOURS="8 20"),
#                        or on wake if the Mac was asleep then; plus a check every 30 seconds for
#                        the app's "Find jobs now" button (src/watch.ts)
#   npm run unschedule   remove both
# Run it from a normal Terminal window: it records where node and claude are, because launchd
# doesn't load your shell's PATH.
set -eu
# Owner's choice (2026-09-29): three runs a day. LinkedIn/Indeed/JobStreet (JSearch) are searched on
# the first run of the day only, so this fits JSearch's free plan.
HOURS="${HOURS:-8 13 18}"
INTERVALS=""
for H in $HOURS; do
  INTERVALS="$INTERVALS<dict><key>Hour</key><integer>$H</integer><key>Minute</key><integer>0</integer></dict>"
done
LABEL=com.jobautomation.finder
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
WATCH_LABEL=com.jobautomation.finder-watch
WATCH_PLIST="$HOME/Library/LaunchAgents/$WATCH_LABEL.plist"
WORKER="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="gui/$(id -u)"

if [ "${1:-}" = uninstall ]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  launchctl bootout "$DOMAIN/$WATCH_LABEL" 2>/dev/null || true
  rm -f "$PLIST" "$WATCH_PLIST"
  echo "Removed. The job finder won't run on its own, and the app's Find jobs now button won't reach this Mac."
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
  <array>$INTERVALS</array>
  <key>StandardOutPath</key><string>$WORKER/logs/finder.log</string>
  <key>StandardErrorPath</key><string>$WORKER/logs/finder.log</string>
</dict>
</plist>
PLIST_EOF

cat > "$WATCH_PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$WATCH_LABEL</string>
  <key>WorkingDirectory</key><string>$WORKER</string>
  <key>ProgramArguments</key>
  <array><string>$NODE_DIR/npm</string><string>run</string><string>--silent</string><string>watch</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$NODE_DIR:/usr/bin:/bin</string>
    <key>CLAUDE_BIN</key><string>$CLAUDE_BIN</string>
  </dict>
  <key>StartInterval</key><integer>30</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$WORKER/logs/watch.log</string>
  <key>StandardErrorPath</key><string>$WORKER/logs/watch.log</string>
</dict>
</plist>
PLIST_EOF

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl bootout "$DOMAIN/$WATCH_LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$WATCH_PLIST"
echo "Installed. The job finder runs every day at these hours: $HOURS (24-hour clock)."
echo "It also checks every 30 seconds for the app's Find jobs now button."
echo "To run it now as a test:  launchctl kickstart $DOMAIN/$LABEL"
echo "Its output goes to:       $WORKER/logs/finder.log"
