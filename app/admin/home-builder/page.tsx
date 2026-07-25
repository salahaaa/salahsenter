import { redirect } from "next/navigation";

export default function HomeBuilderPage() {
  redirect("/admin/settings#layout");
}
