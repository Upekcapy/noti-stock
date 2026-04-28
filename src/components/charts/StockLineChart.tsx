"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
  LineSeries,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type MouseEventHandler,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { StockHistoryPoint } from "@/lib/types/notistock";

export type ChartPointSelection = {
  time: number;
  price: number;
};

export function StockLineChart({
  points,
  selectedPoint,
  onPointSelect,
}: {
  points: StockHistoryPoint[];
  selectedPoint?: ChartPointSelection | null;
  onPointSelect?: (selection: ChartPointSelection) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const selectedPriceLineRef = useRef<IPriceLine | null>(null);
  const onPointSelectRef = useRef(onPointSelect);

  useEffect(() => {
    onPointSelectRef.current = onPointSelect;
  }, [onPointSelect]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#475569",
      },
      grid: {
        vertLines: { color: "#eef2f7" },
        horzLines: { color: "#eef2f7" },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
      crosshair: {
        horzLine: { color: "#94a3b8" },
        vertLine: { color: "#94a3b8" },
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#16a34a",
      lineWidth: 3,
      lastValueVisible: true,
      priceLineVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, [], { zOrder: "top" });

    const handleClick: MouseEventHandler<Time> = (param) => {
      const activeSeries = seriesRef.current;
      const callback = onPointSelectRef.current;
      if (!activeSeries || !callback || !param.point) return;

      const seriesData = param.seriesData.get(activeSeries);
      const dataPrice = getLineDataPrice(seriesData);
      const coordinatePrice = activeSeries.coordinateToPrice(param.point.y);
      const price = dataPrice ?? coordinatePrice;
      const time = getLineDataTime(seriesData) ?? param.time;

      if (price === null || price === undefined || !Number.isFinite(Number(price))) return;
      if (typeof time !== "number") return;

      callback({
        time,
        price: Math.round(Number(price) * 100) / 100,
      });
    };

    chart.subscribeClick(handleClick);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
      }
    });

    observer.observe(containerRef.current);

    return () => {
      chart.unsubscribeClick(handleClick);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      selectedPriceLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    const data: LineData<UTCTimestamp>[] = points.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.value,
    }));

    seriesRef.current.setData(data);
    chartRef.current.timeScale().fitContent();
  }, [points]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !markersRef.current) return;

    if (selectedPriceLineRef.current) {
      series.removePriceLine(selectedPriceLineRef.current);
      selectedPriceLineRef.current = null;
    }

    if (!selectedPoint) {
      markersRef.current.setMarkers([]);
      return;
    }

    selectedPriceLineRef.current = series.createPriceLine({
      price: selectedPoint.price,
      color: "#dc2626",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      lineVisible: true,
      axisLabelVisible: true,
      axisLabelColor: "#dc2626",
      axisLabelTextColor: "#ffffff",
      title: "Alert",
    });

    markersRef.current.setMarkers([
      {
        time: selectedPoint.time as UTCTimestamp,
        position: "atPriceMiddle",
        price: selectedPoint.price,
        shape: "circle",
        color: "#dc2626",
        size: 1.4,
      },
    ]);
  }, [selectedPoint]);

  return (
    <div
      ref={containerRef}
      className={`h-[360px] w-full ${onPointSelect ? "cursor-crosshair" : ""}`}
    />
  );
}

function getLineDataPrice(data: unknown) {
  if (!data || typeof data !== "object" || !("value" in data)) return undefined;

  const value = data.value;
  return typeof value === "number" ? value : undefined;
}

function getLineDataTime(data: unknown) {
  if (!data || typeof data !== "object" || !("time" in data)) return undefined;

  const time = data.time;
  return typeof time === "number" ? time : undefined;
}
