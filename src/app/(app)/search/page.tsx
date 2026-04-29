import { SearchClient } from "@/components/stocks/SearchClient";
import { requireCurrentUser } from "@/lib/auth";
import { normalizeSymbol } from "@/lib/utils";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol = "" } = await searchParams;
  const user = await requireCurrentUser();

  return <SearchClient initialSymbol={normalizeSymbol(symbol)} isDemo={Boolean(user.isDemo)} />;
}
