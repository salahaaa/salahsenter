import Link from "next/link";
import { getHomeContentSettings } from "@/lib/home-content";
import { getPlatformIdentity } from "@/lib/platform-identity";

export async function Footer() {
  const [content, identity] = await Promise.all([getHomeContentSettings(), getPlatformIdentity()]);
  const platformName = identity.platformName || content.platformName || "صلاح سنتر";
  return (
    <footer className="mt-20 border-t bg-slate-950 text-white">
      <div className="container grid gap-8 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <h2 className="text-2xl font-black">{platformName}</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            {content.footerText || "منصة مول إلكتروني متعددة المتاجر قابلة للإدارة والتوسع."}
          </p>
        </div>
        <div>
          <h3 className="font-black">روابط سريعة</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li><Link href="/apply-store">طلب فتح متجر</Link></li>
            <li><Link href="/track-order">تتبع الطلبات</Link></li>
            <li><Link href="/loyalty">برنامج ولاء المول 🎁</Link></li>
            <li><Link href="/courier">بوابة مندوبي التوصيل 🚚</Link></li>
            <li><Link href="/admin">لوحة الأدمن</Link></li>
            <li><Link href="/merchant">لوحة التاجر</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-black">{identity.footer.trustTitle}</h3>
          <p className="mt-4 text-sm leading-7 text-slate-300">{identity.footer.trustText}</p>{identity.contactPhone ? <p className="mt-3 text-sm font-bold">{identity.contactPhone}</p> : null}{identity.officialEmail ? <p className="mt-1 text-sm font-bold">{identity.officialEmail}</p> : null}{identity.footer.showAdminLink ? <Link className="mt-3 inline-block text-xs underline" href="/admin">لوحة الإدارة</Link> : null}
        </div>
      </div>
    </footer>
  );
}
