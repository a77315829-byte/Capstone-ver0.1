import { KrwEquivalent, FxToolbar } from "./FxExchange";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Box, Button, CloseButton, Flex, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import { ChevronLeftIcon, RepeatIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import tokens from '../services/tokens.service';
import { loadHoldingSnapshot } from '../services/holdingSnapshot.service';
import { summarizeHoldings, type HoldingMarket, type HoldingValuation } from '../utils/holdingValuation';

type Snapshot = Awaited<ReturnType<typeof loadHoldingSnapshot>>;
const amount = (value: number | null | undefined, market: HoldingMarket, signed = false) => value == null ? '—' :
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: market === 'US' ? 'USD' : 'KRW',
    minimumFractionDigits: market === 'US' ? 2 : 0, maximumFractionDigits: market === 'US' ? 2 : 0,
    signDisplay: signed ? 'exceptZero' : 'auto' }).format(value);
const percent = (value: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const pnlColor = (value: number | null) => value == null || value === 0 ? 'app.subtleText' : value > 0 ? '#E53E3E' : '#3182CE';

export default function HoldingsPanel({ market }: { market: HoldingMarket }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [viewMarket, setViewMarket] = useState(market);
  const [savedSnapshot, setSnapshot] = useState<(Snapshot & { market: HoldingMarket }) | null>(null);
  const snapshot = savedSnapshot?.market === viewMarket ? savedSnapshot : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); request.current?.abort(); requestAnimationFrame(() => trigger.current?.focus()); }, []);

  useEffect(() => { setViewMarket(market); }, [market]);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  useEffect(() => {
    const onTrade = (event: Event) => {
      const update = (event as CustomEvent<{ market: HoldingMarket; openPanel: boolean }>).detail;
      if (!update || !['KR', 'US'].includes(update.market)) return;
      if (update.openPanel) { setViewMarket(update.market); setOpen(true); }
      // Both currencies are visible, so either market's trade/funding must refresh cash.
      setRevision(value => value + 1);
    };
    window.addEventListener('antitude:portfolio-updated', onTrade);
    return () => window.removeEventListener('antitude:portfolio-updated', onTrade);
  }, []);

  useEffect(() => {
    setSnapshot(null);
    setError('');
    if (!open) return;
    const controller = new AbortController();
    request.current = controller;
    let pending = false;
    const refresh = async () => {
      if (pending || controller.signal.aborted) return;
      if (!tokens.isAuthenticated()) { setNeedsLogin(true); setSnapshot(null); return; }
      setNeedsLogin(false);
      pending = true;
      setLoading(true);
      try {
        const data = await loadHoldingSnapshot(viewMarket, controller.signal);
        if (!controller.signal.aborted) { setSnapshot({ ...data, market: viewMarket }); setError(''); }
      } catch (reason: any) {
        if (!controller.signal.aborted) {
          if (reason?.response?.status === 401) { setNeedsLogin(true); setSnapshot(null); }
          else setError('보유 현황을 갱신하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    const onVisible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(onVisible, 10000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [open, viewMarket, revision]);

  const selectHolding = (holding: HoldingValuation) => {
    const selection = { symbol: holding.symbol, name: holding.name, market: holding.market,
      marketType: viewMarket, ...(viewMarket === 'US' ? { exchange: holding.exchange || 'NAS' } : {}) };
    const params = new URLSearchParams({ market: viewMarket, symbol: holding.symbol, name: holding.name, stockMarket: holding.market });
    if (selection.exchange) params.set('exchange', selection.exchange);
    navigate({ pathname: '/exchange', search: params.toString() });
    window.dispatchEvent(new CustomEvent('antitude:stock-selected', { detail: selection }));
    close();
  };
  const totals = snapshot ? summarizeHoldings(snapshot.holdings) : null;

  return <>
    <Button ref={trigger} position="fixed" right={{ base: "12px", md: "0" }} bottom={{ base: "max(12px, env(safe-area-inset-bottom))", md: "auto" }} top={{ base: "auto", md: "150px", xl: "178px" }} zIndex={1050}
      display={open ? 'none' : 'flex'} px="2" py="3" h={{ base: "44px", md: "auto" }} minW="40px" flexDirection={{ base: "row", md: "column" }} gap="1"
      borderRightRadius={{ base: "10px", md: "0" }} borderLeftRadius="10px" bg="brand.500" color="white" boxShadow="md"
      _hover={{ bg: 'brand.600' }} aria-label="내 보유주식 열기" aria-expanded={open} aria-controls="holdings-panel"
      onClick={() => { setViewMarket(market); setOpen(true); }}>
      <ChevronLeftIcon boxSize="5" /><Text fontSize="12px" lineHeight="1.5" whiteSpace={{ base: "normal", md: "pre-line" }}>{'내\n보유\n주식'}</Text>
    </Button>
    {open && <Box as="aside" id="holdings-panel" aria-label="내 보유주식" position="fixed" right="0"
      top={{ base: '0', md: '68px', xl: '82px' }} bottom="0" w={{ base: 'calc(100vw - 16px)', sm: '360px' }}
      zIndex={{ base: 1400, md: 1100 }} bg="app.background" borderLeftWidth="1px" borderColor="app.borderSoft" boxShadow="-8px 0 28px rgba(73,52,30,.12)"
      display="flex" flexDirection="column" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <Box p="5" pb="3" borderBottomWidth="1px" borderColor="app.borderSoft">
        <Flex align="center" justify="space-between"><Text as="h2" fontSize="lg" fontWeight="900">내 보유주식</Text><CloseButton ref={closeButton} aria-label="보유주식 닫기" onClick={close} /></Flex>
        <HStack mt="3" spacing="2">{(['KR', 'US'] as const).map(value => <Button key={value} size="sm" flex="1"
          variant={viewMarket === value ? 'solid' : 'outline'} colorScheme="orange" aria-pressed={viewMarket === value}
          onClick={() => setViewMarket(value)}>{value === 'KR' ? '국내 · 원화' : '미국 · 달러'}</Button>)}</HStack>
      </Box>
      <Box flex="1" overflowY="auto" p="4" aria-busy={loading}>
        {needsLogin ? <Stack py="8" spacing="4"><Text>로그인하면 내 보유주식과 수익률을 볼 수 있어요.</Text><Button colorScheme="orange" onClick={() => navigate('/login')}>로그인</Button></Stack> : <>
          {loading && !snapshot && <Flex align="center" justify="center" gap="3" py="8"><Spinner size="sm" /><Text fontSize="sm">보유주식과 시세를 불러오는 중…</Text></Flex>}
          {error && <Text role="alert" fontSize="sm" color="orange.700" mb="3">{error}{snapshot ? ' 아래는 마지막 조회 결과입니다.' : ''}</Text>}
          {snapshot && totals && <>
            <Box mb="3" bg="white" borderWidth="1px" borderColor="app.borderSoft" borderRadius="12px" p="4">
              <Text as="h3" fontSize="sm" fontWeight="800">보유 현금</Text>
              {snapshot.wallet ? <Stack spacing="3" mt="3">{(['KRW', 'USD'] as const).map(currency => {
                const balance = snapshot.wallet![currency];
                const cashMarket = currency === 'USD' ? 'US' : 'KR';
                return <Box key={currency}>
                  <Flex justify="space-between" align="baseline"><Text fontSize="xs" color="app.subtleText">{currency === 'KRW' ? '원화 잔액' : '달러 잔액'}</Text><Text fontSize="lg" fontWeight="900">{amount(balance.cash, cashMarket)}</Text></Flex>
                  {currency === 'USD' && <Box textAlign="right"><KrwEquivalent usd={balance.cash} /></Box>}
                  <Flex justify="space-between" mt="1" fontSize="xs" color="app.subtleText"><Text>주문·환전 가능</Text><Text>{amount(balance.availableCash, cashMarket)}</Text></Flex>
                  {balance.reservedCash > 0 && <Flex justify="space-between" mt="1" fontSize="xs" color="app.subtleText"><Text>미체결 예약금</Text><Text>{amount(balance.reservedCash, cashMarket)}</Text></Flex>}
                </Box>;
              })}</Stack> : <Text mt="3" fontSize="xs" color="orange.700" role="status">현금을 조회하지 못했어요. 새로고침으로 다시 확인해 주세요.</Text>}
              <Text mt="3" fontSize="10px" color="app.subtleText">잔액에는 미체결 예약금이 포함됩니다. 주문·환전 가능 금액은 예약금을 제외한 현금입니다.</Text>
            </Box>
            <Box bg="white" borderWidth="1px" borderColor="app.borderSoft" borderRadius="12px" p="4">
              <Text fontSize="xs" color="app.subtleText">보유주식 평가금액</Text>
              <Text mt="1" fontSize="2xl" fontWeight="900">{amount(totals.evaluationAmount, viewMarket)}</Text>
              {viewMarket === 'US' && <KrwEquivalent usd={totals.evaluationAmount} />}
              <Text mt="3" fontSize="xs" color="app.subtleText">평가손익 · 수익률</Text>
              <Text mt="1" fontSize="lg" fontWeight="900" color={pnlColor(totals.profitLoss)}>{amount(totals.profitLoss, viewMarket, true)} <Text as="span" fontSize="sm">({percent(totals.profitLossRate)})</Text></Text>
              {viewMarket === 'US' && <KrwEquivalent usd={totals.profitLoss} signed />}
              <Flex mt="3" justify="space-between" fontSize="xs" color="app.subtleText"><Text>총 매수금액</Text><Text>{amount(totals.buyAmount, viewMarket)}</Text></Flex>
              {totals.incomplete && <Text mt="3" fontSize="xs" color="orange.700">일부 종목의 시세를 받지 못해 전체 평가금액과 손익을 계산할 수 없어요.</Text>}
            </Box>
            <Flex mt="5" mb="3" align="center" justify="space-between"><Text fontWeight="800" fontSize="sm">보유 종목 <Badge ml="1" colorScheme="orange">{snapshot.holdings.length}</Badge></Text><Text fontSize="xs" color="app.subtleText">종목을 누르면 차트로 이동</Text></Flex>
            {!snapshot.holdings.length && <Text textAlign="center" py="10" color="app.subtleText" fontSize="sm">아직 보유한 {viewMarket === 'US' ? '미국' : '국내'} 주식이 없어요.</Text>}
            <Stack spacing="3">{snapshot.holdings.map(holding => <Box as="button" type="button" key={`${holding.exchange || viewMarket}:${holding.symbol}`}
              textAlign="left" w="100%" p="4" bg="white" borderWidth="1px" borderColor="app.borderSoft" borderRadius="10px"
              _hover={{ bg: 'orange.50' }} _focusVisible={{ outline: '2px solid', outlineColor: 'brand.500' }} onClick={() => selectHolding(holding)}>
              <Text fontWeight="800" fontSize="sm" lineHeight="1.6">{holding.name}</Text>
              <Flex justify="space-between" mt="1" color="app.subtleText" fontSize="xs"><Text>{holding.symbol}</Text><Text>{holding.quantity.toLocaleString('ko-KR')}주</Text></Flex>
              <Text mt="3" fontSize="lg" fontWeight="900" color={pnlColor(holding.profitLoss)}>{amount(holding.profitLoss, viewMarket, true)} <Text as="span" fontSize="xs">({percent(holding.profitLossRate)})</Text></Text>
              {viewMarket === 'US' && <KrwEquivalent usd={holding.profitLoss} signed />}
              <Flex justify="space-between" mt="3" fontSize="xs"><Text color="app.subtleText">평가금액</Text><Text>{amount(holding.evaluationAmount, viewMarket)}</Text></Flex>
              {viewMarket === 'US' && <Box textAlign="right"><KrwEquivalent usd={holding.evaluationAmount} /></Box>}
              <Flex justify="space-between" mt="2" fontSize="xs"><Text color="app.subtleText">평균 매수가</Text><Text>{amount(holding.avgPrice, viewMarket)}</Text></Flex>
              <Flex justify="space-between" mt="2" fontSize="xs"><Text color="app.subtleText">현재가</Text><Text>{holding.currentPrice == null ? '시세 확인 불가' : amount(holding.currentPrice, viewMarket)}</Text></Flex>
            </Box>)}</Stack>
          </>}
        </>}
      </Box>
      {!needsLogin && <Box p="4" borderTopWidth="1px" borderColor="app.borderSoft" bg="app.background">
        <Flex justify="space-between" align="center"><Text fontSize="10px" color="app.subtleText">{snapshot ? `${new Date(snapshot.checkedAt).toLocaleTimeString('ko-KR')} 조회 · 10초마다 갱신` : '시세와 보유 내역을 확인합니다.'}</Text><Button size="xs" variant="ghost" leftIcon={<RepeatIcon />} isLoading={loading} onClick={() => setRevision(value => value + 1)}>새로고침</Button></Flex>
        <Box my="2"><FxToolbar /></Box>
        <Text mt="2" fontSize="10px" color="app.subtleText">현재 보유분의 평가손익이며 수수료·세금은 제외합니다. 원화 표시는 현재 조회 환율로 환산한 참고값이며 매수 당시 환율에 따른 환차손익은 포함하지 않습니다. 미체결 주문은 체결 후 반영됩니다.</Text>
      </Box>}
    </Box>}
  </>;
}
