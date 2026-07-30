export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, ok } from "@/lib/api";
import { getCurrentSession } from "@/lib/auth";
import { db, stores } from "@/lib/db";

const STAGING_SQL_SCRIPT = `-- =====================================================================
-- Salah Center ERP Bridge — SQL Server Staging Tables Installer
-- Compatible with: YemenSoft Onyx Pro / Al-Amien / Smacc / MS SQL Server
-- =====================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SalahCenter_Staging_Orders]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[SalahCenter_Staging_Orders](
    [SyncId] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [OrderId] [nvarchar](100) NOT NULL,
    [OrderNumber] [nvarchar](50) NOT NULL,
    [StoreId] [nvarchar](100) NOT NULL,
    [CustomerName] [nvarchar](150) NULL,
    [CustomerPhone] [nvarchar](50) NULL,
    [GrandTotal] [decimal](18, 2) NOT NULL,
    [Status] [nvarchar](50) NOT NULL,
    [TaxInvoiceNumber] [nvarchar](100) NULL,
    [PayloadJson] [nvarchar](max) NULL,
    [IsProcessed] [bit] NOT NULL DEFAULT ((0)),
    [CreatedAt] [datetime] NOT NULL DEFAULT (getdate()),
    [ProcessedAt] [datetime] NULL
  );
  CREATE INDEX [IX_SalahCenter_Orders_Processed] ON [dbo].[SalahCenter_Staging_Orders] ([IsProcessed], [CreatedAt]);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SalahCenter_Staging_Inventory]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[SalahCenter_Staging_Inventory](
    [SyncId] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [StoreId] [nvarchar](100) NOT NULL,
    [Sku] [nvarchar](100) NOT NULL,
    [AvailableStock] [int] NOT NULL,
    [WarehouseCode] [nvarchar](50) NULL,
    [IsSynced] [bit] NOT NULL DEFAULT ((0)),
    [UpdatedAt] [datetime] NOT NULL DEFAULT (getdate())
  );
  CREATE INDEX [IX_SalahCenter_Inventory_Synced] ON [dbo].[SalahCenter_Staging_Inventory] ([IsSynced], [Sku]);
END
`;

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session?.userId) return fail("يجب تسجيل الدخول كتاجر", 401);

    const url = new URL(request.url);
    const storeId = url.searchParams.get("storeId");
    const format = url.searchParams.get("format") || "json";

    let storeRow: any = null;
    if (storeId) {
      [storeRow] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    } else {
      [storeRow] = await db.select().from(stores).where(eq(stores.merchantId, session.userId)).limit(1);
    }

    if (format === "sql") {
      return new Response(STAGING_SQL_SCRIPT, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="salahcenter-erp-staging-${storeRow?.storeNumber || "default"}.sql"`
        }
      });
    }

    const appSettings = {
      SalahCenter: {
        BaseUrl: "https://salahsenter.vercel.app",
        ApiKey: "PUT_YOUR_SALAH_SYNC_API_KEY_HERE",
        StoreId: storeRow?.id || "",
        StoreNumber: storeRow?.storeNumber || "",
        StoreName: storeRow?.name || "متجري",
        SyncIntervalSeconds: 60,
        ErpProvider: "OnyxPro",
        Database: {
          ConnectionString: "Server=localhost;Database=OnyxProDB;User Id=sa;Password=secret;TrustServerCertificate=true;",
          OrdersStagingTable: "SalahCenter_Staging_Orders",
          InventoryStagingTable: "SalahCenter_Staging_Inventory"
        }
      }
    };

    return ok({
      store: storeRow ? { id: storeRow.id, name: storeRow.name, storeNumber: storeRow.storeNumber } : null,
      appSettings,
      sqlDownloadUrl: `/api/integrations/erp/staging-installer?format=sql&storeId=${storeRow?.id || ""}`,
      agentDownloadUrl: "https://github.com/salahaaa/salahsenter/releases",
      message: "تم تجهيز ملف إعدادات الوكيل المحلي وسكربت الجداول المحاسبية بنجاح"
    });
  } catch (error) {
    return fail("تعذر إعداد ملف الوكيل", 500);
  }
}
