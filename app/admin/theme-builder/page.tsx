import { redirect } from "next/navigation";

export default function ThemeBuilderPage() {
  redirect("/admin/settings#theme");
}
