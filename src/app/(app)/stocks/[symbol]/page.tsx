import { StockDetailClient } from "@/components/stocks/StockDetailClient";
import { normalizeSymbol } from "@/lib/utils";

export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;

  return <StockDetailClient symbol={normalizeSymbol(symbol)} />;
}
