import React, { useEffect, useState } from "react";
import {
  Badge, Box, Button, Card, CardBody, CardHeader, Divider, Flex, Grid,
  Heading, Spacer, Spinner, Stack, Table, TableContainer, Tbody,
  Td, Text, Th, Thead, Tr,
} from "@chakra-ui/react";
import api from "../services/api.service";
import CompactStockNews from "./CompactStockNews";
import type { UsChartPoint, UsExchangeCode, UsStockQuote } from "../types/usMarket.types";

type Section = "orderbook" | "executions" | "information";
type Level = { level: number; askPrice: number; askVolume: number; bidPrice: number; bidVolume: number };
type OrderBook = { levels: Level[]; totalAskVolume: number; totalBidVolume: number; fetchedAt: string };
type Execution = { time: string; price: number; quantity: number; cumulativeVolume: number; changeRate: number; direction: "UP" | "DOWN" | "FLAT" };
type Executions = { items: Execution[]; fetchedAt: string };
type Props = { symbol: string; exchange: UsExchangeCode; quote: UsStockQuote | null; history: UsChartPoint[]; intraday?: boolean; chartLabel?: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US");
const UP = "#F05B45";
const DOWN = "#2F67D8";
const panel = { p: "16px", borderWidth: "1px", borderColor: "app.borderSoft", borderRadius: "10px", bg: "white", minW: 0 };
const price = (value?: number | null) => value != null && Number.isFinite(value) && value > 0 ? money.format(value) : "-";
// KIS uses zero for unsupported valuation fields, especially ETF fundamentals.
const ratio = (value?: number | null) => value != null && Number.isFinite(value) && value !== 0 ? value.toFixed(2) : "-";
const perShare = (value?: number | null) => value != null && Number.isFinite(value) && value !== 0 ? money.format(value) : "-";

function Metric({ label, value, color = "app.text" }: { label: string; value: React.ReactNode; color?: string }) {
  return <Flex gap="3" align="baseline" minW="0"><Text fontSize="11px" color="app.subtleText">{label}</Text><Spacer /><Text fontSize="11px" fontWeight="800" textAlign="right" color={color}>{value}</Text></Flex>;
}

function Selector({ title, description, selected, onClick, children }: { title: string; description: string; selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Card as="button" type="button" aria-pressed={selected} onClick={onClick} textAlign="left" w="100%" h="100%" minH="300px"
    borderWidth="1px" borderColor={selected ? "brand.500" : "app.borderSoft"} bg="white"
    boxShadow={selected ? "0 10px 28px rgba(242, 100, 56, 0.10)" : "0 8px 24px rgba(73, 52, 30, 0.04)"}
    transition="border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease"
    _hover={{ borderColor: "brand.400", transform: "translateY(-1px)" }} _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "3px" }}>
    <CardHeader pb="2" w="100%"><Flex align="center"><Box><Heading size="sm" color={selected ? "brand.600" : "app.text"}>{title}</Heading><Text mt="1" fontSize="10px" color="app.subtleText">{description}</Text></Box><Spacer />{selected && <Badge bg="orange.50" color="brand.600" borderRadius="full">선택됨</Badge>}</Flex></CardHeader>
    <CardBody pt="2" w="100%">{children}</CardBody>
  </Card>;
}

function StockInformation({ quote, history, intraday, chartLabel }: Pick<Props, "quote" | "history" | "intraday" | "chartLabel">) {
  if (!quote) return <Text py="12" textAlign="center" color="app.subtleText">종목 정보를 불러오는 중입니다.</Text>;
  const isEtf = quote.assetType === "ETF";
  const daily = [...history].sort((a, b) => b.time - a.time).slice(0, 8);
  const metrics: [string, string][] = [
    ["시가총액", quote.marketCap ? compact.format(quote.marketCap) : "-"],
    ["PER", ratio(quote.per)],
    ["PBR", ratio(quote.pbr)],
    ["EPS", perShare(quote.eps)],
    ["BPS", perShare(quote.bps)],
  ];
  return <Stack spacing="4">
    <Grid templateColumns={{ base: "1fr", xl: "0.92fr 1.16fr 1.12fr" }} gap="14px" alignItems="stretch">
      <Box {...panel}>
        <Heading size="sm">{isEtf ? "ETF 개요" : "기업 개요"}</Heading>
        <Flex mt="22px" gap="14px" align="center"><Flex w="58px" h="58px" flexShrink="0" borderRadius="full" bg="#E4E4E4" align="center" justify="center" fontSize="18px" fontWeight="900" color="#77736F" aria-hidden="true">{quote.name.slice(0, 1)}</Flex><Box minW="0"><Text fontSize="18px" fontWeight="900">{quote.name}</Text><Text mt="3px" fontSize="10px" color="app.subtleText">{quote.symbol} · {quote.longName}</Text><Badge mt="7px" borderRadius="full" variant="outline" borderColor="#E4CDB8" color="#695B4F">{quote.market} · {isEtf ? "ETF" : "주식"}</Badge></Box></Flex>
        <Text mt="20px" fontSize="11px" lineHeight="1.8" color="#554C44">{quote.summary || `${quote.market} 시장에 상장된 ${isEtf ? "ETF" : "기업"}입니다.`}</Text>
        <Stack mt="5" spacing="3" divider={<Divider borderColor="#EFE4D9" />}>
          <Metric label="거래 통화" value="USD" />
          <Metric label="상장주식수" value={quote.sharesOutstanding ? number.format(quote.sharesOutstanding) : "-"} />
          {isEtf && <><Metric label="분류" value={quote.category || quote.etpTypeName || "-"} /><Metric label="운용사" value={quote.issuer || "-"} /><Metric label="추종 지수" value={quote.benchmark || "-"} /></>}
        </Stack>
      </Box>
      <Box {...panel}>
        <Heading size="sm">핵심 지표</Heading>
        <Text mt="2" fontSize="11px" color="app.subtleText">현재 종목의 기업가치와 주당 지표</Text>
        <Box mt="18px" borderWidth="1px" borderColor="#E8D8C8" borderRadius="8px" overflow="hidden">
          <Flex px="12px" py="3" bg="#FFFCF8" borderBottomWidth="1px" borderColor="#E8D8C8"><Text fontSize="11px" color="app.subtleText">구분</Text><Spacer /><Text fontSize="11px" color="app.subtleText">현재 제공 값</Text></Flex>
          <Stack px="12px" spacing="0" divider={<Divider borderColor="#EFE4D9" />}>
            {metrics.map(([label, value]) => <Box key={label} py="14px"><Metric label={label} value={value} /></Box>)}
          </Stack>
        </Box>
        <Text mt="14px" fontSize="10px" color="app.subtleText">출처: 한국투자증권. 제공되지 않은 지표는 -로 표시됩니다.</Text>
      </Box>
      <Box {...panel}>
        <Heading size="sm">주가 정보</Heading>
        <Stack mt="20px" spacing="15px">
          <Metric label="52주 최고" value={price(quote.fiftyTwoWeekHigh)} color={UP} />
          <Metric label="52주 최저" value={price(quote.fiftyTwoWeekLow)} color={DOWN} />
          <Metric label="전일 종가" value={price(quote.previousClose)} />
          <Metric label="시가" value={price(quote.open)} />
          <Metric label="고가" value={price(quote.high)} color={UP} />
          <Metric label="저가" value={price(quote.low)} color={DOWN} />
          <Metric label="거래량" value={`${number.format(quote.volume)}주`} />
        </Stack>
        <Divider my="5" borderColor="#EADCCD" />
        <Text fontSize="11px" color="app.subtleText">가격은 미국 달러 기준이며, 거래 시간과 데이터 제공 시점에 따라 갱신됩니다.</Text>
      </Box>
    </Grid>
    <Box {...panel}>
      <Heading size="sm">가격 기록</Heading><Text mt="1" fontSize="11px" color="app.subtleText">선택한 {chartLabel || "일봉"} 차트의 최근 기록 · USD{intraday ? " · 미국 동부시간" : ""}</Text>
      <TableContainer mt="3"><Table size="sm"><Thead bg="#FFFCF8"><Tr><Th>날짜</Th><Th isNumeric>종가</Th><Th isNumeric>거래량</Th></Tr></Thead><Tbody>
        {daily.map(point => <Tr key={point.time}><Td>{new Date(point.time * 1000).toLocaleString("ko-KR", { timeZone: intraday ? "America/New_York" : "UTC", year: "numeric", month: "numeric", day: "numeric", ...(intraday ? { hour: "2-digit", minute: "2-digit" } as const : {}) })}</Td><Td isNumeric>{price(point.close)}</Td><Td isNumeric>{number.format(point.volume)}</Td></Tr>)}
        {!daily.length && <Tr><Td colSpan={3} textAlign="center" py="8">가격 기록이 없습니다.</Td></Tr>}
      </Tbody></Table></TableContainer>
    </Box>
  </Stack>;
}

function OrderBookPanel({ book, quote }: { book: OrderBook | null; quote: UsStockQuote | null }) {
  if (!book?.levels.length) return <Text py="12" textAlign="center" color="app.subtleText">제공된 호가가 없습니다.</Text>;
  const levels = book.levels.slice(0, 10);
  const { totalAskVolume, totalBidVolume } = book;
  function side(ask: boolean) {
    const rows = ask ? [...levels].reverse() : levels;
    let sum = 0;
    const cumulative = new Map(levels.map(row => { sum += ask ? row.askVolume : row.bidVolume; return [row.level, sum]; }));
    return <Box {...panel}>
      <Heading size="sm" mb="4" color={ask ? UP : DOWN}>{ask ? "매도 호가" : "매수 호가"}</Heading>
      <Grid templateColumns="1fr 1fr 1fr" mb="3" gap="2">{["누적(주)", "수량(주)", "가격(USD)"].map(label => <Text key={label} fontSize="10px" textAlign="right" color="app.subtleText">{label}</Text>)}</Grid>
      <Stack spacing="1">{rows.map(row => <Grid key={row.level} templateColumns="1fr 1fr 1fr" py="2" gap="2" bg={ask ? "#FFFCFA" : "#FBFCFF"}>
        <Text fontSize="11px" textAlign="right" color="app.subtleText">{number.format(cumulative.get(row.level) || 0)}</Text><Text fontSize="11px" textAlign="right">{number.format(ask ? row.askVolume : row.bidVolume)}</Text><Text fontSize="11px" fontWeight="800" textAlign="right" color={ask ? UP : DOWN}>{price(ask ? row.askPrice : row.bidPrice)}</Text>
      </Grid>)}</Stack>
      <Divider my="3" /><Metric label={ask ? "총 매도잔량" : "총 매수잔량"} value={`${number.format(ask ? totalAskVolume : totalBidVolume)}주`} color={ask ? UP : DOWN} />
    </Box>;
  }
  return <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(180px, 0.65fr) minmax(0, 1fr)" }} gap="14px" alignItems="start">
    {side(true)}
    <Box {...panel} bg="#FFFCFA"><Heading size="sm">현재가</Heading><Text mt="5" fontSize="24px" fontWeight="900">{price(quote?.price)}</Text><Text mt="1" fontSize="12px" fontWeight="800" color={(quote?.changeRate || 0) >= 0 ? UP : DOWN}>{quote ? `${quote.changeRate >= 0 ? "▲" : "▼"} ${money.format(Math.abs(quote.changePrice))} (${quote.changeRate.toFixed(2)}%)` : "-"}</Text><Divider my="5" /><Stack spacing="3"><Metric label="전일 종가" value={price(quote?.previousClose)} /><Metric label="시가" value={price(quote?.open)} /><Metric label="고가" value={price(quote?.high)} color={UP} /><Metric label="저가" value={price(quote?.low)} color={DOWN} /></Stack></Box>
    {side(false)}
  </Grid>;
}

export default function UsMarketDetails({ symbol, exchange, quote, history, intraday, chartLabel }: Props) {
  const [section, setSection] = useState<Section>("orderbook");
  const [book, setBook] = useState<OrderBook | null>(null);
  const [executions, setExecutions] = useState<Executions | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({ orderbook: false, executions: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const load = async () => {
      const base = `/us-stocks/${encodeURIComponent(exchange)}/${encodeURIComponent(symbol)}`;
      const results = await Promise.allSettled([
        api.get(`${base}/orderbook`, { signal: controller.signal, timeout: 8000 }),
        api.get(`${base}/executions?limit=30`, { signal: controller.signal, timeout: 8000 }),
      ]);
      if (controller.signal.aborted) return;
      setBook(results[0].status === "fulfilled" ? results[0].value.data.data : null);
      setExecutions(results[1].status === "fulfilled" ? results[1].value.data.data : null);
      setErrors({ orderbook: results[0].status === "rejected", executions: results[1].status === "rejected" });
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 10000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [symbol, exchange, revision]);
  const rows = executions?.items || [];
  const selectedError = section !== "information" && errors[section];
  const summary: [string, string][] = [
    ["종목명", quote?.name || symbol],
    ["종목코드", symbol],
    ["시장", quote?.market || exchange],
    ["유형", quote ? quote.assetType === "ETF" ? "ETF" : "주식" : "-"],
    ["시가총액", quote?.marketCap ? compact.format(quote.marketCap) : "-"],
    ["PER", ratio(quote?.per)],
    ["PBR", ratio(quote?.pbr)],
    ["EPS", perShare(quote?.eps)],
  ];
  return <>
    <Grid mt="5" templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }} gap="5" alignItems="stretch">
      <Selector title="호가" description="매도·매수 가격과 잔량" selected={section === "orderbook"} onClick={() => setSection("orderbook")}>
        <Stack spacing="5px">{(book?.levels || []).slice(0, 4).map(level => <Grid key={level.level} templateColumns="1fr 1fr 1fr" gap="2"><Text fontSize="10px" color={UP}>{price(level.askPrice)}</Text><Text textAlign="center" fontSize="10px" color="app.subtleText">{number.format(level.askVolume + level.bidVolume)}</Text><Text textAlign="right" fontSize="10px" color={DOWN}>{price(level.bidPrice)}</Text></Grid>)}</Stack>
        {!book?.levels.length && <Text fontSize="11px" color="app.subtleText">{loading ? "호가 불러오는 중…" : errors.orderbook ? "호가 연결 확인 필요" : "제공된 호가가 없습니다."}</Text>}
        <Flex mt="12px" pt="10px" borderTopWidth="1px" borderColor="app.borderSoft"><Text fontSize="10px" color={UP}>매도 {book ? number.format(book.totalAskVolume) : "-"}</Text><Spacer /><Text fontSize="10px" color={DOWN}>매수 {book ? number.format(book.totalBidVolume) : "-"}</Text></Flex>
      </Selector>
      <Selector title="체결" description="종목별 시장 체결" selected={section === "executions"} onClick={() => setSection("executions")}>
        <Grid templateColumns="1fr 1fr 1fr" gap="2" mb="8px"><Text fontSize="10px" color="app.subtleText">시간</Text><Text textAlign="center" fontSize="10px" color="app.subtleText">체결가</Text><Text textAlign="right" fontSize="10px" color="app.subtleText">수량</Text></Grid>
        {rows.slice(0, 4).map((row, index) => <Grid key={`${row.time}-${index}`} templateColumns="1fr 1fr 1fr" gap="2" py="4px"><Text fontSize="10px" color="app.subtleText">{row.time}</Text><Text textAlign="center" fontSize="10px" fontWeight="800" color={row.direction === "UP" ? UP : row.direction === "DOWN" ? DOWN : "app.text"}>{price(row.price)}</Text><Text textAlign="right" fontSize="10px">{number.format(row.quantity)}</Text></Grid>)}
        {!rows.length && <Text fontSize="11px" color="app.subtleText">{loading ? "체결 불러오는 중…" : errors.executions ? "체결 연결 확인 필요" : "제공된 체결 내역이 없습니다."}</Text>}
      </Selector>
      <Selector title="정보" description="기업·ETF 핵심 정보" selected={section === "information"} onClick={() => setSection("information")}>
        <Stack spacing="0">{summary.map(([label, value], index) => <Box key={label} py="7px" borderBottomWidth={index === summary.length - 1 ? "0" : "1px"} borderColor="#F1E8DE"><Metric label={label} value={value} /></Box>)}</Stack>
      </Selector>
      <Box minW="0" h="100%"><CompactStockNews key={`${exchange}:${symbol}`} symbol={symbol} name={quote?.name || symbol} market={quote?.market || ({ NAS: "NASDAQ", NYS: "NYSE", AMS: "AMEX" }[exchange])} marketType="US" /></Box>
    </Grid>
    <Card mt="5" borderColor="app.borderSoft" boxShadow="0 8px 24px rgba(73, 52, 30, 0.04)">
      <CardHeader pb="3"><Flex align="center" gap="3" wrap="wrap"><Box><Heading size="sm">{section === "orderbook" ? "호가 현황" : section === "executions" ? "시장 체결" : "종목 상세 정보"}</Heading><Text mt="1" fontSize="11px" color="app.subtleText">{section === "information" ? "현재 종목의 기업 정보와 투자 지표를 확인합니다." : "미국 주식 데이터를 10초 간격으로 갱신합니다. 가격 단위: USD"}</Text></Box><Spacer />{section !== "information" && <Button size="xs" variant="outline" isLoading={loading} onClick={() => setRevision(value => value + 1)}>새로고침</Button>}</Flex></CardHeader>
      <CardBody pt="0">
        {section === "information" ? <StockInformation quote={quote} history={history} intraday={intraday} chartLabel={chartLabel} /> : loading && !book && !executions ? <Flex minH="260px" justify="center" align="center"><Spinner color="brand.500" /></Flex> : selectedError ? <Flex py="12" align="center" direction="column" gap="3"><Text color="app.subtleText">{section === "orderbook" ? "호가" : "체결"} 정보를 불러오지 못했습니다.</Text><Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>다시 시도</Button></Flex> : section === "orderbook" ? <OrderBookPanel book={book} quote={quote} /> : <Box {...panel}>
          <TableContainer maxH="460px" overflowY="auto"><Table size="sm"><Thead bg="#FFFCF8" position="sticky" top="0"><Tr><Th>시간</Th><Th isNumeric>체결가 (USD)</Th><Th isNumeric>수량</Th><Th isNumeric>누적 거래량</Th><Th isNumeric>등락률</Th></Tr></Thead><Tbody>{rows.map((row, index) => <Tr key={`${row.time}-${index}`}><Td>{row.time}</Td><Td isNumeric color={row.direction === "UP" ? UP : row.direction === "DOWN" ? DOWN : "app.text"}>{price(row.price)}</Td><Td isNumeric>{number.format(row.quantity)}</Td><Td isNumeric>{number.format(row.cumulativeVolume)}</Td><Td isNumeric>{row.changeRate.toFixed(2)}%</Td></Tr>)}{!rows.length && <Tr><Td colSpan={5} textAlign="center" py="12" color="app.subtleText">제공된 체결 내역이 없습니다.</Td></Tr>}</Tbody></Table></TableContainer>
        </Box>}
      </CardBody>
    </Card>
  </>;
}
