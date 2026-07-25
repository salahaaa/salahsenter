#!/bin/bash
# All-in-one: start dev server, wait, scan all pages, kill, print report.
# Runs in a single bash invocation so the background server stays alive for the scan.
set -m
cd /home/user
export PATH="/usr/lib/postgresql/17/bin:$PATH"

# kill any stale server
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next/dist/bin/next" 2>/dev/null
sleep 2

# start dev server in background
node ./node_modules/next/dist/bin/next dev -p 3000 > /tmp/devscan_final.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# wait for it to be ready
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then echo "Server ready after ${i}s"; break; fi
  sleep 1
done

if [ "$CODE" != "200" ]; then
  echo "SERVER FAILED TO START. Log:"
  cat /tmp/devscan_final.log | tail -20
  exit 1
fi

# scan all pages via node (server is alive in this same process group)
node scripts/scan-pages.js 2>&1

# cleanup
kill -9 $SERVER_PID 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
echo "=== Server stopped. Scan complete. ==="
