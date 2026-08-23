'use client';

import { useEffect, useRef } from 'react';
import {
  createChart, CrosshairMode,
  IChartApi, ISeriesApi, UTCTimestamp,
  CandlestickSeries,
} from 'lightweight-charts';

const PERIODS = [
  { label: '1m', value: 1 },
  { label: '5m', value: 5 },
  { label: '15m', value: 15 },
  { label: '1H', value: 60 },
  { label: '4H', value: 240 },
  { label: '1D', value: 1440 },
] as const;

export const CHART_PERIODS = PERIODS;
export type ChartPeriod = typeof PERIODS[number]['value'];

interface Props {
  market: string;
  period: number;
  onPeriodChange: (p: number) => void;
  lastPrice?: number;
}

export default function CandleChart({ market, period, onPeriodChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#8b8f9c',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    // v5 series API
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load + refresh candles
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/markets/${market}/klines?period=${period}&limit=300`);
        if (!res.ok || !alive || !seriesRef.current) return;
        const json = await res.json();
        const rows = (json.klines ?? []) as [number, number, number, number, number, number][];
        const data = rows
          .map(k => ({
            time: k[0] as UTCTimestamp,
            open: k[1], high: k[2], low: k[3], close: k[4],
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

        seriesRef.current.setData(data);
        chartRef.current?.timeScale().fitContent();
      } catch {
        /* keep previous */
      }
    };

    load();
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [market, period]);

  return (
    <div className="flex flex-col h-full">
      {/* Period selector */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              period === p.value ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 min-h-[260px]" />
    </div>
  );
}