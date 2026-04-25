import { DashboardClient } from "@/components/stocks/DashboardClient";
import { requireCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireCurrentUser();

  return <DashboardClient user={user} />;
}
