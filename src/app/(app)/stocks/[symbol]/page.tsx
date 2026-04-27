import { redirect } from "next/navigation";
import { getStockSearchPath } from "@/lib/utils";

export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;

  redirect(getStockSearchPath(symbol));
}
