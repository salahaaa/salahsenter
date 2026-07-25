#!/bin/bash
set -m
cd /home/user
pkill -9 -f "next-server" 2>/dev/null; pkill -9 -f "next/dist/bin/next" 2>/dev/null
sleep 2
cat > /tmp/scan_b2.js <<'NODE'
const BASE="http://localhost:3000";
async function login(e,p){const r0=await fetch(BASE+"/");const sc0=r0.headers.get("set-cookie")||"";const csrf=(sc0.match(/mall_csrf=([^;]+)/)||[])[1]||"";const jar=sc0.split(",").map(c=>c.split(";")[0].trim()).join("; ");const r1=await fetch(BASE+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json","x-csrf-token":csrf,"x-requested-with":"XMLHttpRequest",cookie:jar},body:JSON.stringify({email:e,password:p})});const sc=r1.headers.get("set-cookie")||"";return `mall_session=${(sc.match(/mall_session=([^;]+)/)||[])[1]||""}; mall_csrf=${(sc.match(/mall_csrf=([^;]+)/)||[])[1]||csrf}`;}
const ER=["شيء ما حدث","حدث خطأ","تعذر","Something went wrong","Digest:","Application error","relation \"","does not exist","TypeError"];
async function scan(path,cookie){try{const r=await fetch(BASE+path,{headers:{cookie},redirect:"manual"});const html=await r.text();const errs=ER.filter(m=>html.includes(m));const isLogin=r.status>=300&&r.status<400&&(r.headers.get("location")||"").includes("login");return{path,status:r.status,size:html.length,errs,isLogin,ok:r.status===200&&errs.length===0&&!isLogin};}catch(e){return{path,status:0,size:0,errs:[e.message],isLogin:false,ok:false};}}
async function main(){
const mc=await login(process.env.TEST_MERCHANT_EMAIL || "",process.env.TEST_MERCHANT_PASSWORD || "");
const pages=["/merchant/onboarding","/merchant/operations-settings","/merchant/orders","/merchant/product-intake","/merchant/product-taxonomy","/merchant/products","/merchant/reports","/merchant/settings","/merchant/smart-setup","/merchant/smart-tools"];
console.log("MERCHANT BATCH 2 ("+pages.length+")");console.log("=".repeat(70));
const res=[];for(const p of pages){const r=await scan(p,mc);res.push(r);const flag=r.ok?"✓ OK ":r.isLogin?"⚠ LOGIN":"✗ BROKEN";console.log(`  ${flag} ${String(r.status).padEnd(4)} ${(r.size+"b").padStart(7)}  ${r.path} ${r.errs.length?"⚑ "+r.errs.join(";"):""}`);await new Promise(res=>setTimeout(res,2000));}
const ok=res.filter(r=>r.ok).length;const broken=res.filter(r=>!r.ok);console.log(`\nOK: ${ok}/${res.length} | BROKEN: ${broken.length}`);}
main().catch(e=>{console.error(e);process.exit(1);});
NODE
NODE_OPTIONS="--max-old-space-size=1500" node ./node_modules/next/dist/bin/next dev -p 3000 > /tmp/devb2.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 40); do CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null); if [ "$CODE" = "200" ]; then echo "Ready after ${i}s"; break; fi; sleep 1; done
node /tmp/scan_b2.js 2>&1
kill -9 $SERVER_PID 2>/dev/null; pkill -9 -f "next-server" 2>/dev/null
echo "=== done ==="
