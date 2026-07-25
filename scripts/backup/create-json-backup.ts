import "dotenv/config";
import { createBackup } from "@/lib/backup";
import { client } from "@/lib/db";

try {
  const backup = await createBackup();
  console.log(JSON.stringify(backup, null, 2));
} finally {
  await client.end({ timeout: 5 }).catch(() => undefined);
}
