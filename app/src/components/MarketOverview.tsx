import { useEffect, useState } from 'react';
import { Badge, Box, Button, Flex, Heading, SimpleGrid, Spinner, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { RepeatIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api.service';
import { KrwEquivalent } from './FxExchange';

type Market = 'KR' | 'US';
const SORTS = { volume: '거래량', turnover: '거래대금', gainers: '상승률', losers: '하락률' } as const;
type RankingSort = keyof typeof SORTS;
const sortDescription = { volume: '누적 거래량 많은 순', turnover: '누적 거래대금 많은 순', gainers: '전일 종가 대비 상승률 높은 순', losers: '전일 종가 대비 하락률 큰 순' };
type Leader = { symbol: string; name: string; market: string; exchange?: string; price: number; changeRate: number | null; volume: number; turnover: number | null };
type Section<T> = { data: T; asOf: string | null; stale: boolean; error: string | null };
type Overview = {
  market: Market; sort: RankingSort; ranking: Section<Leader[]> & { period?: 'session' | 'two-day'; periodLabel?: string };
  indices: Array<Section<{ price: number; change: number | null; changeRate: number | null; date: string | null } | null> & { code: string; name: string }>;
  sessions: Record<Market, { isOpen: boolean; limitOrderAllowed: boolean; sessionLabel: string; localDate: string; localTime: string; message: string }>;
  source: string; refreshSeconds: number;
};
const numeric = (value: number | null | undefined, digits = 2) => value == null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: digits });
const change = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const tone = (value: number | null) => value == null || value === 0 ? 'app.subtleText' : value > 0 ? '#E53E3E' : '#3182CE';
const time = (value: string | null) => value ? new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '조회 대기';
const money = (value: number | null, market: Market) => {
  if (value == null) return '—';
  const unit = value >= 1e12 ? [1e12, '조'] as const : value >= 1e8 ? [1e8, '억'] as const : value >= 1e4 ? [1e4, '만'] as const : [1, ''] as const;
  return `${numeric(value / unit[0])}${unit[1]} ${market === 'US' ? '달러' : '원'}`;
};
export default function MarketOverview({ market }: { market: Market }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSort = searchParams.get('ranking') || 'volume';
  const sort: RankingSort = Object.prototype.hasOwnProperty.call(SORTS, requestedSort) ? requestedSort as RankingSort : 'volume';
  const [saved, setSaved] = useState<Overview | null>(null);
  const data = saved?.market === market ? saved : null;
  const ranking = data?.sort === sort ? data.ranking : null;
  const isPeriodRanking = ranking?.period === 'two-day';
  const volumeLabel = isPeriodRanking ? sort === 'volume' ? '평균 거래량 · 주' : '당일 거래량 · 주' : '거래량 · 주';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    setError('');
    const refresh = async () => {
      if (pending || controller.signal.aborted) return;
      pending = true; setLoading(true);
      try {
        const result = await api.get<Overview>('/markets/overview', { params: { market, sort }, signal: controller.signal, timeout: 30000 });
        if (!controller.signal.aborted) { setSaved(result.data); setError(''); }
      } catch {
        if (!controller.signal.aborted) setError('시장 정보를 갱신하지 못했어요. 잠시 후 다시 시도해 주세요.');
      } finally { pending = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh();
    const visible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(visible, 30000);
    document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [market, sort, revision]);
  const selectSort = (value: RankingSort) => { const params = new URLSearchParams(searchParams); params.set('ranking', value); setSearchParams(params); };
  const toStock = (item: Leader) => '/exchange?' + new URLSearchParams({ market, ranking: sort, symbol: item.symbol, name: item.name, stockMarket: item.market,
    ...(item.exchange ? { exchange: item.exchange } : {}) }).toString();
  return <Box px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }} maxW="1680px" mx="auto">
    <Flex justify="space-between" align="start" gap="4" mb="6" wrap="wrap">
      <Box><Text color="brand.500" fontSize="xs" fontWeight="800" letterSpacing=".08em">MARKET OVERVIEW</Text>
        <Heading mt="2" size="lg">시장 둘러보기</Heading><Text mt="2" fontSize="sm" color="app.subtleText">오늘 거래가 활발한 종목을 살펴보고, 원하는 종목의 차트로 들어가 보세요.</Text></Box>
      <Button size="sm" mr={{ base: 0, md: 6 }} variant="outline" leftIcon={<RepeatIcon />} isLoading={loading} onClick={() => setRevision(value => value + 1)}>새로고침</Button>
    </Flex>
    {error && <Text role="alert" mb="4" color="orange.700" fontSize="sm">{error}{ranking ? ' 아래는 마지막 조회 결과입니다.' : ''}</Text>}
    {data && <>
      <Flex gap="3" align="center" wrap="wrap" mb="4">{(['KR', 'US'] as const).map(value => <Badge key={value} colorScheme={data.sessions[value].isOpen ? 'green' : 'gray'} borderRadius="full" px="3" py="1">
        {value === 'KR' ? '국내' : '미국'} · {data.sessions[value].sessionLabel ?? (data.sessions[value].isOpen ? '정규장' : '장 마감 / 개장 전')}
      </Badge>)}<Text fontSize="xs" color="app.subtleText">{data.source} · 30초마다 갱신</Text></Flex>
      <SimpleGrid columns={{ base: 2, xl: 4 }} gap={{ base: 3, md: 4 }} mb="7" aria-label="주요 시장 지수">
        {data.indices.map(index => <Box key={index.code} p={{ base: 4, md: 5 }} bg="white" borderWidth="1px" borderColor="app.borderSoft" borderRadius="14px">
          <Text fontSize="sm" fontWeight="800">{index.name}</Text>
          <Text mt="3" fontSize={{ base: 'xl', md: '2xl' }} fontWeight="900" letterSpacing="-.03em">{numeric(index.data?.price)}</Text>
          <Text mt="1" fontSize="sm" fontWeight="700" color={tone(index.data?.changeRate ?? null)}>{index.data ? `${index.data.change != null && index.data.change > 0 ? '+' : ''}${numeric(index.data.change)} (${change(index.data.changeRate)})` : '조회 불가'}</Text>
          <Text mt="3" fontSize="10px" color="app.subtleText">{index.data?.date ? `${index.data.date} · ` : ''}{time(index.asOf)} 조회{index.stale ? ' · 갱신 지연' : ''}</Text>
        </Box>)}
      </SimpleGrid>
    </>}
      <Box bg="white" borderRadius="16px" borderWidth="1px" borderColor="app.borderSoft" overflow="hidden">
        <Flex px={{ base: 4, md: 6 }} pt="5" pb="4" justify="space-between" align="center" gap="3" wrap="wrap">
          <Box><Heading size="md">{market === 'KR' ? '국내' : '미국'} {SORTS[sort]} 순위</Heading><Text mt="2" fontSize="xs" color="app.subtleText">{market === 'KR' ? 'KRX' : '나스닥 · 뉴욕 · 아멕스'} · {isPeriodRanking ? ranking.periodLabel : sortDescription[sort]} · 주식·ETF 등</Text></Box>
          <Badge colorScheme="orange" variant="subtle" borderRadius="full" px="3" py="1">종목 선택 → 차트·주문</Badge>
        </Flex>
        <Flex role="group" aria-label="순위 기준" px={{ base: 4, md: 6 }} pb="4" gap="2" wrap="wrap">
          {(Object.keys(SORTS) as RankingSort[]).map(value => <Button key={value} size="sm" colorScheme="orange" variant={sort === value ? 'solid' : 'outline'} aria-pressed={sort === value} onClick={() => { if (sort !== value) selectSort(value); }}>{SORTS[value]}</Button>)}
        </Flex>
        <Box px={{ base: 4, md: 6 }} pb="3"><Text fontSize="xs" color="app.subtleText">{ranking?.asOf ? `${new Date(ranking.asOf).toLocaleString('ko-KR')} 조회 · ` : ''}{ranking?.periodLabel ?? '당일 누적 순위'} · 당일 순위 미제공 시 마지막 수신 결과 또는 최근 기간 데이터를 표시합니다.</Text>
          {(ranking?.error || ranking?.stale) && <Text role="status" mt="2" fontSize="xs" color="orange.700">{ranking.error}{ranking.stale && ranking.data.length ? ' 마지막 조회 결과입니다.' : ''}</Text>}
        </Box>
        {loading && !ranking ? <Flex role="status" gap="3" py="12" align="center" justify="center"><Spinner size="sm" /><Text>{SORTS[sort]} 순위를 불러오는 중…</Text></Flex> : !ranking?.data.length ? <Text role="status" py="12" px="4" textAlign="center" color="app.subtleText">조건에 맞는 종목이 없거나 순위를 받지 못했어요. 상단 검색도 이용할 수 있어요.</Text> : <TableContainer aria-busy={loading}>
          <Table size="sm" variant="simple" aria-label={`${market === 'KR' ? '국내' : '미국'} ${SORTS[sort]} 순위`}><Thead bg="app.background"><Tr><Th w="45px">순위</Th><Th>종목</Th><Th isNumeric>현재가{market === 'US' ? ' · USD' : ' · 원'}</Th><Th isNumeric aria-sort={sort === 'gainers' ? 'descending' : sort === 'losers' ? 'ascending' : undefined}>{isPeriodRanking ? '기간 등락률' : '등락률'}</Th><Th isNumeric aria-sort={sort === 'volume' || sort === 'turnover' ? 'descending' : undefined}>{sort === 'turnover' ? `${isPeriodRanking ? '평균 ' : ''}거래대금 · ${market === 'US' ? 'USD' : '원'}` : volumeLabel}</Th></Tr></Thead>
            <Tbody>{ranking.data.map((item, index) => <Tr key={`${item.exchange || market}:${item.symbol}`} _hover={{ bg: 'orange.50' }}>
              <Td color={index < 3 ? 'brand.500' : 'app.subtleText'} fontWeight="800" textAlign="center">{index + 1}</Td>
              <Td maxW={{ base: '200px', md: '440px' }} py="4"><Flex as={Link} to={toStock(item)} gap="3" align="center" borderRadius="6px" _focusVisible={{ outline: '2px solid', outlineColor: 'brand.500' }} aria-label={`${item.name} 차트 보기`}>
                <Flex display={{ base: 'none', md: 'flex' }} boxSize="36px" flexShrink="0" borderRadius="12px" bg="orange.50" color="brand.500" align="center" justify="center" fontSize="xs" fontWeight="900" aria-hidden="true">{market === 'KR' ? item.name.slice(0, 1) : item.symbol.slice(0, 2)}</Flex>
                <Box minW="0"><Text fontSize="sm" fontWeight="800" whiteSpace="normal" wordBreak="keep-all">{item.name}</Text><Text mt="1" fontSize="xs" color="app.subtleText">{item.symbol} · {item.market}</Text></Box><ArrowForwardIcon flexShrink="0" color="app.subtleText" />
              </Flex></Td>
              <Td isNumeric fontWeight="700">{market === 'US' ? '$' : ''}{numeric(item.price, market === 'US' ? 4 : 0)}{market === 'US' && <KrwEquivalent usd={item.price} />}</Td>
              <Td isNumeric color={tone(item.changeRate)} fontWeight="700">{change(item.changeRate)}</Td><Td isNumeric title={sort === 'turnover' ? `${numeric(item.turnover)} ${market === 'US' ? 'USD' : '원'}` : undefined}>{sort === 'turnover' ? <>{money(item.turnover, market)}{market === 'US' && item.turnover != null && <KrwEquivalent usd={item.turnover} />}</> : numeric(item.volume, 0)}</Td>
            </Tr>)}</Tbody></Table>
        </TableContainer>}
      </Box>
  </Box>;
}
