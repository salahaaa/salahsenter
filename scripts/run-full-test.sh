#!/bin/bash
set -m
cd /home/user
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next/dist/bin/next" 2>/dev/null
sleep 2

echo "=== Start server ==="
NODE_OPTIONS="--max-old-space-size=800" node ./node_modules/next/dist/bin/next start -p 3000 > /tmp/test-server.log 2>&1 &
SERVER_PID=$!

for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then echo "Ready ${i}s"; break; fi
  sleep 1
done

echo "=== Full test ==="
node scripts/full-test.js
echo "=== test exit $? ==="

kill -9 $SERVER_PID 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
echo "=== done ==="
