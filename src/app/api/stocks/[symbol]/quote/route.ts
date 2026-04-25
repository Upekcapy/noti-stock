import { NextResponse } from "next/server";
import { getStockQuote } from "@/lib/stocks";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await context.params;
  const quote = await getStockQuote(symbol);

  return NextResponse.json({ quote });
}
