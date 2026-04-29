import { Suspense } from "react";
import { AlertsClient } from "@/components/alerts/AlertsClient";
import { requireCurrentUser } from "@/lib/auth";

export default async function AlertsPage() {
  const user = await requireCurrentUser();

  return (
    <Suspense fallback={null}>
      <AlertsClient isDemo={Boolean(user.isDemo)} />
    </Suspense>
  );
}
