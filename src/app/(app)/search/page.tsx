import { SearchClient } from "@/components/stocks/SearchClient";
import { normalizeSymbol } from "@/lib/utils";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol = "" } = await searchParams;

  return <SearchClient initialSymbol={normalizeSymbol(symbol)} />;
}
