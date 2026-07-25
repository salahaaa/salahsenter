#!/bin/bash
set -m
cd /home/user
pkill -9 -f "next-server" 2>/dev/null; pkill -9 -f "next/dist/bin/next" 2>/dev/null
sleep 2
cat > /tmp/rem.js <<'NODE'
const BASE="http://localhost:3000";
async function login(e,p){const r0=await fetch(BASE+"/");const sc0=r0.headers.get("set-cookie")||"";const csrf=(sc0.match(/mall_csrf=([^;]+)/)||[])[1]||"";const jar=sc0.split(",").map(c=>c.split(";")[0].trim()).join("; ");const r1=await fetch(BASE+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json","x-csrf-token":csrf,"x-requested-with":"XMLHttpRequest",cookie:jar},body:JSON.stringify({email:e,password:p})});const sc=r1.headers.get("set-cookie")||"";return `mall_session=${(sc.match(/mall_session=([^;]+)/)||[])[1]||""}; mall_csrf=${(sc.match(/mall_csrf=([^;]+)/)||[])[1]||csrf}`;}
async function main(){
const ac=await login(process.env.TEST_ADMIN_EMAIL || "",process.env.TEST_ADMIN_PASSWORD || "");
const mc=await login(process.env.TEST_MERCHANT_EMAIL || "",process.env.TEST_MERCHANT_PASSWORD || "");
console.log("AFTER optimization — heavy pages:");
const tests=[["/admin/wings",ac,"/admin/wings"],["/merchant",mc,"/merchant"]];
for(const [p,ck,label] of tests){
  const r=await fetch(BASE+p,{headers:{cookie:ck}});
  const kb=(r.status===200?(await r.text()).length/1024:0).toFixed(1);
  console.log(`  ${label}: HTTP ${r.status}  ${kb} KB`);
  await new Promise(res=>setTimeout(res,1500));
}
}
main().catch(e=>{console.error(e);process.exit(1);});
NODE
NODE_OPTIONS="--max-old-space-size=1500" node ./node_modules/next/dist/bin/next dev -p 3000 > /tmp/devrem.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 40); do CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null); if [ "$CODE" = "200" ]; then echo "Ready after ${i}s"; break; fi; sleep 1; done
node /tmp/rem.js 2>&1
kill -9 $SERVER_PID 2>/dev/null; pkill -9 -f "next-server" 2>/dev/null
echo "=== done ==="
