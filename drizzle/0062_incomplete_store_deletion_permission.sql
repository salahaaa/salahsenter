-- Narrow admin capability for irreversible deletion of abandoned, non-operational stores.
INSERT INTO "permissions" ("code", "name", "group", "description") VALUES
  ('stores.incomplete.delete', 'حذف متجر غير مكتمل', 'إدارة المتاجر', 'حذف نهائي آمن لمتجر pending بلا بيانات تشغيلية')
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "group" = EXCLUDED."group", "description" = EXCLUDED."description";
