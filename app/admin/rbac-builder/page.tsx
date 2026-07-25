import { redirect } from "next/navigation";

export default function RbacBuilderPage() {
  redirect("/admin/roles#advanced-rbac");
}
