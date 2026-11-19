import { useEffect, useRef } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp, type Time } from 'lightweight-charts';
import type { UsChartPoint } from '../types/usMarket.types';

const eastern = new Intl.DateTimeFormat('ko-KR', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
const easternDate = new Intl.DateTimeFormat('ko-KR', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit' });

export default function UsStockChart({ data, intraday, resetKey }: { data: UsChartPoint[]; intraday: boolean; resetKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volume = useRef<ISeriesApi<'Histogram'> | null>(null);
  const fitted = useRef(false);
  useEffect(() => {
    if (!container.current) return;
    const instance = createChart(container.current, {
      width: container.current.clientWidth, height: 540,
      layout: { background: { color: '#ffffff' }, textColor: '#1A202C' },
      grid: { vertLines: { color: '#edf2f7' }, horzLines: { color: '#edf2f7' } },
      rightPriceScale: { borderColor: '#e2e8f0', scaleMargins: { top: 0.08, bottom: 0.23 } },
      timeScale: { borderColor: '#e2e8f0', timeVisible: intraday, secondsVisible: false,
        ...(intraday ? { tickMarkFormatter: (time: Time, type: number) => typeof time === 'number' ? (type > 2 ? clock : easternDate).format(new Date(time * 1000)) : '' } : {}) },
      localization: { locale: 'ko-KR', timeFormatter: (time: Time) => typeof time === 'number' ? (intraday ? eastern : date).format(new Date(time * 1000)) : String(time) },
    });
    chart.current = instance;
    candles.current = instance.addCandlestickSeries({ upColor: '#e53e3e', downColor: '#3182ce', borderUpColor: '#e53e3e', borderDownColor: '#3182ce', wickUpColor: '#e53e3e', wickDownColor: '#3182ce' });
    volume.current = instance.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    volume.current.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    fitted.current = false;
    const resize = new ResizeObserver(entries => { const entry = entries[0]; if (entry) instance.applyOptions({ width: entry.contentRect.width }); });
    resize.observe(container.current);
    return () => { resize.disconnect(); instance.remove(); chart.current = null; candles.current = null; volume.current = null; };
  }, [intraday, resetKey]);
  useEffect(() => {
    candles.current?.setData(data.map(point => ({ ...point, time: point.time as UTCTimestamp })));
    volume.current?.setData(data.map(point => ({ time: point.time as UTCTimestamp, value: point.volume, color: point.close >= point.open ? '#e53e3e' : '#3182ce' })));
    if (data.length && !fitted.current) { chart.current?.timeScale().fitContent(); fitted.current = true; }
  }, [data, intraday, resetKey]);
  return <Box position="relative" h="540px" w="100%">
    <Box ref={container} h="100%" w="100%" />
    {!data.length && <Text position="absolute" inset="0" display="flex" alignItems="center" justifyContent="center" color="app.subtleText" bg="white">제공된 차트 데이터가 없습니다.</Text>}
  </Box>;
}
