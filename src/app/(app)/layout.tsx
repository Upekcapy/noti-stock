import { AppShell } from "@/components/layout/AppShell";
import { requireCurrentUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireCurrentUser();

  return <AppShell user={user}>{children}</AppShell>;
}
