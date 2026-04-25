import { Suspense } from "react";
import { AlertsClient } from "@/components/alerts/AlertsClient";

export default function AlertsPage() {
  return (
    <Suspense fallback={null}>
      <AlertsClient />
    </Suspense>
  );
}
