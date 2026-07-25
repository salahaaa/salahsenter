# Windows Typecheck Compatibility Fix

**التاريخ:** 25 يوليو 2026  
**السبب:** `release:verify:source` كان يستخدم صيغة Unix غير متوافقة مع Windows CMD/PowerShell.

## المشكلة القديمة

```text
NODE_OPTIONS='--max-old-space-size=1400' npm run typecheck
```

هذه تعتمد على:

```text
inline environment assignment
single quotes
```

وكلاهما لا يعملان في Windows CMD، لذلك تظهر رسالة مثل:

```text
'NODE_OPTIONS' is not recognized as an internal or external command
```

## الإصلاح

تم تغيير script `typecheck` نفسه إلى صيغة مستقلة عن shell:

```json
"typecheck": "node --max-old-space-size=1400 ./node_modules/typescript/bin/tsc --noEmit"
```

وتم تغيير `release:verify:source` إلى:

```text
npm run typecheck
```

وبذلك لا توجد صيغة Unix أو اقتباسات مفردة في مسار الإصدار.

## النتيجة

تعمل الأوامر نفسها على:

```text
Windows CMD
Windows PowerShell
Linux
macOS
GitHub Actions
```

الأمر الذي يستخدمه المستخدم الآن:

```bash
npm run typecheck
```

والتحقق الكامل:

```bash
npm run release:verify:source
```

## التحقق

```text
npm run typecheck                    ✅
npm run release:verify:source        ✅
Unit tests                            ✅ 77 files / 214 tests
npm audit --audit-level=high          ✅ 0 vulnerabilities
```
