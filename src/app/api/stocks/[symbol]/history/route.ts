import { NextResponse } from "next/server";
import { getStockHistoryResult, parseStockRange } from "@/lib/stocks";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await context.params;
  const { searchParams } = new URL(request.url);
  const range = parseStockRange(searchParams.get("range"));
  const { points, source } = await getStockHistoryResult(symbol, range);

  return NextResponse.json({ range, points, source });
}
