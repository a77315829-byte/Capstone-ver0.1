import { useMemo, useState } from 'react';
import { Box, Text, useBreakpointValue } from '@chakra-ui/react';
import { performanceDomain, holdingPerformancePoints, seoulDay, type HoldingDay } from '../utils/performanceChart';

export default function PerformanceChart({ history, capital, currentProfit, currentRate, days, computedAt }: {
 history: HoldingDay[]; capital: number; currentProfit: number; currentRate: number | null; days?: number; computedAt: string;
}) {
 const now = Date.parse(computedAt);
 const firstDate = history[0]?.date || seoulDay(now);
 const points = useMemo(() => holdingPerformancePoints(history, { date: seoulDay(now), profit: currentProfit, rate: currentRate, buyAmount: capital, observedAt: computedAt }, days), [history, capital, currentProfit, currentRate, days, now, computedAt]);
 const domain = performanceDomain(days, now, firstDate);
 const [selected, setSelected] = useState<{ index: number; range: string } | null>(null);
 const rangeKey = `${days}:${computedAt}`;
 const active = selected?.range === rangeKey ? points[selected.index] : null;
 const width = useBreakpointValue({ base: 320, md: 820 }) ?? 820;
 const height = 250, left = 45, right = 22, top = 24, bottom = 34;
 const values = points.flatMap(p => p.value === null ? [] : [p.value]);
 const min = Math.min(-4, Math.floor(Math.min(...values) - 1));
 const max = Math.max(8, Math.ceil(Math.max(...values) + 1));
 const x = (time: number) => left + (time - domain.start) / (domain.end - domain.start) * (width - left - right);
 const y = (value: number) => top + (max - value) / (max - min) * (height - top - bottom);
 const path = points.map((p, i) => p.value === null ? '' : i === 0 || points[i - 1].value === null ? `M${x(p.time)} ${y(p.value)}` : `L${x(p.time)} ${y(p.value)}`).join(' ');
 const select = (index: number) => setSelected({ index: Math.max(0, Math.min(points.length - 1, index)), range: rangeKey });
 const signed = (value: number | null) => value === null ? '수익률 없음' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
 const tickCount = width < 500 ? 3 : 5;
 return <Box position="relative" w="100%" data-testid="performance-chart" data-range-start={seoulDay(domain.start)} data-range-end={seoulDay(domain.end)}>
  <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
   role="img" tabIndex={0} aria-label="국내·미국 보유 주식 평가수익률. 각 기록 시점의 매입금액 기준. 좌우 방향키로 날짜별 조회"
   style={{ touchAction: 'pan-y' }}
   onFocus={() => select(points.length - 1)} onBlur={() => setSelected(null)}
   onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    select(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : (selected?.index ?? points.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1));
   }}
   onPointerMove={event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const time = domain.start + (((event.clientX - bounds.left) / bounds.width * width - left) / (width - left - right)) * (domain.end - domain.start);
    const index = points.reduce((best, point, i) => Math.abs(point.time - time) < Math.abs(points[best].time - time) ? i : best, 0);
    select(index);
   }}
   onPointerDown={event => event.currentTarget.focus()}
   onPointerLeave={event => { if (event.pointerType === 'mouse') setSelected(null); }}>
   {Array.from({ length: 7 }, (_, i) => min + (max - min) * i / 6).map(tick => <g key={tick}>
    <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#EEE4D8" />
    <text x="6" y={y(tick) + 4} fontSize="11" fill="#827A72">{tick > 0 ? '+' : ''}{Number(tick.toFixed(1))}%</text>
   </g>)}
   <path d={path} fill="none" stroke="#F66B24" strokeWidth="2" strokeLinejoin="round" />
   {points.map((p, i) => p.value === null ? null : <circle key={i} cx={x(p.time)} cy={y(p.value)} r="3" fill="#F66B24"><title>{p.date} {signed(p.value)}</title></circle>)}
   {Array.from({ length: tickCount }, (_, i) => domain.start + (domain.end - domain.start) * i / (tickCount - 1)).map((time, i) => <text key={i} x={x(time)} y={height - 8} fontSize="10" textAnchor={i === 0 ? 'start' : i === tickCount - 1 ? 'end' : 'middle'} fill="#827A72">{seoulDay(time).slice(2).replaceAll('-', '/')}</text>)}
   {active && <line x1={x(active.time)} x2={x(active.time)} y1={top} y2={height - bottom} stroke="#827A72" strokeDasharray="3 3" />}
  </svg>
  {active && <Box role="status" pointerEvents="none" position="absolute" top="4px" right="8px" maxW="calc(100% - 55px)" bg="white" border="1px solid" borderColor="app.border" borderRadius="6px" px="3" py="2" shadow="sm" fontSize="12px">
   <Text>{active.date} · {active.kind === 'current' ? '현재 보유 주식' : '기록 당시 보유 주식'}</Text>
   <Text fontWeight="bold">{signed(active.value)} · {active.profit >= 0 ? '+' : ''}{Math.round(active.profit).toLocaleString('ko-KR')}원</Text>
   <Text>매입금액 {Math.round(active.buyAmount).toLocaleString('ko-KR')}원</Text>
  </Box>}
  <Text fontSize="12px" color="app.muted">{seoulDay(domain.start)} ~ {seoulDay(domain.end)} · 기록 시작 {firstDate}</Text>
  <Text fontSize="12px" color="app.muted">마우스·터치 또는 방향키로 날짜별 조회 · 조회 시 하루의 마지막 평가를 저장하며 과거 미기록 시세는 표시하지 않습니다.</Text>
  {values.length === 0 && <Text fontSize="sm" color="app.muted">평가 가능한 보유 주식 기록이 없습니다.</Text>}
 </Box>;
}
