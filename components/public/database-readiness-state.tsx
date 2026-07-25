import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { publicDatabaseReadinessCopy, type DatabaseReadinessState } from "@/lib/database-readiness";

/** Public-safe status: no SQL, host, schema object name or credential is exposed. */
export function DatabaseReadinessState({ state, returnHref = "/", returnLabel = "العودة للرئيسية" }: { state: DatabaseReadinessState; returnHref?: string; returnLabel?: string }) {
  const copy = publicDatabaseReadinessCopy(state);
  return (
    <div>
      <EmptyState title={copy.title} description={copy.description} />
      <div className="mt-6 text-center"><Button asChild variant="outline"><Link href={returnHref}>{returnLabel}</Link></Button></div>
    </div>
  );
}
