#!/bin/bash
set -m
cd /home/user
pkill -9 -f "next-server" 2>/dev/null; pkill -9 -f "next/dist/bin/next" 2>/dev/null
sleep 2
node ./node_modules/next/dist/bin/next dev -p 3000 > /tmp/devmerch.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then echo "Ready after ${i}s"; break; fi
  sleep 1
done
node scripts/scan-pages.js 2>&1 | sed -n '/MERCHANT PAGES/,/SUMMARY/p'
kill -9 $SERVER_PID 2>/dev/null; pkill -9 -f "next-server" 2>/dev/null
echo "=== done ==="
