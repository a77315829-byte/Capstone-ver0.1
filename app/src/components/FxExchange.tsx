import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AlertIcon, Box, Button, Flex, FormControl, FormLabel, Input, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, Stack, Text } from '@chakra-ui/react';
import api from '../services/api.service';
import tokens from '../services/tokens.service';

type Rate = { rate: number; date: string; source: string; fetchedAt: string; stale: boolean };
type Currency = 'KRW' | 'USD';
type Direction = 'KRW_TO_USD' | 'USD_TO_KRW';
type Wallet = Record<Currency, { cash: number; reservedCash: number; availableCash: number }>;
type Quote = { quoteId: string; sourceCurrency: Currency; targetCurrency: Currency; sourceAmount: number;
  targetAmount: number; rate: number; rateDate: string; rateSource: string; expiresAt: string; createdAt: string };
const money = (value: number, currency: Currency) => new Intl.NumberFormat('ko-KR', {
  style: 'currency', currency, maximumFractionDigits: currency === 'USD' ? 2 : 0,
}).format(value);
const FxContext = createContext<{ rate: Rate | null; open: () => void }>({ rate: null, open: () => {} });

export function KrwEquivalent({ usd, signed = false }: { usd: number | null | undefined; signed?: boolean }) {
  const { rate } = useContext(FxContext);
  if (!rate || usd == null || !Number.isFinite(usd)) return null;
  return <Text fontSize="xs" color="app.subtleText" title={`${rate.source} · ${rate.date} 기준 · 1 USD = ${rate.rate.toLocaleString('ko-KR')}원`}>
    {rate.stale ? '마지막 환율 기준 ' : '약 '}{signed && usd > 0 ? '+' : ''}{Math.round(usd * rate.rate).toLocaleString('ko-KR')}원
  </Text>;
}

export function FxToolbar() {
  const { rate, open } = useContext(FxContext);
  return <Flex align="center" gap="3" wrap="wrap">
    <Box><Text fontSize="xs">{rate ? `1 USD ≈ ${rate.rate.toLocaleString('ko-KR')}원` : '환율 조회 중 또는 연결 불가'}</Text>
      {rate && <Text fontSize="10px" color="app.subtleText" title={rate.source}>{rate.date} 기준{rate.stale ? ' · 갱신 지연' : ''}</Text>}</Box>
    <Button size="sm" variant="outline" colorScheme="orange" onClick={open}>원화/달러 환전</Button>
  </Flex>;
}

export function FxProvider({ children }: { children: ReactNode }) {
  const [rate, setRate] = useState<Rate | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [history, setHistory] = useState<Quote[]>([]);
  const [direction, setDirection] = useState<Direction>('KRW_TO_USD');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [now, setNow] = useState(Date.now());
  const submitting = useRef(false);
  const amountInput = useRef<HTMLInputElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const source: Currency = direction === 'KRW_TO_USD' ? 'KRW' : 'USD';
  const refreshRate = useCallback(async () => {
    try { setRate((await api.get<Rate>('/fx/rate', { timeout: 20000 })).data); }
    catch { setRate(previous => previous ? { ...previous, stale: true } : null); }
  }, []);
  const refreshWallet = async () => {
    const [balance, records] = await Promise.all([api.get<Wallet>('/fx/wallet'), api.get<Quote[]>('/fx/history')]);
    setWallet(balance.data); setHistory(records.data);
  };
  useEffect(() => {
    void refreshRate();
    const timer = window.setInterval(() => { if (!document.hidden) void refreshRate(); }, 60000);
    return () => window.clearInterval(timer);
  }, [refreshRate]);
  useEffect(() => {
    if (!isOpen) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);
  useEffect(() => {
    if (isOpen && !busy) (quote ? actionButton.current : amountInput.current)?.focus();
  }, [isOpen, busy, quote]);
  const open = async () => {
    if (submitting.current) return;
    setOpen(true); setQuote(null); setWallet(null); setHistory([]); setMessage(''); setSuccess(''); setAmount(''); setUncertain(false);
    if (!tokens.isAuthenticated()) { setMessage('로그인 후 모의계좌 환전을 이용할 수 있어요.'); return; }
    setBusy(true); submitting.current = true;
    try { await refreshWallet(); await refreshRate(); }
    catch { setMessage('계좌 잔액을 불러오지 못했습니다. 다시 열어 주세요.'); }
    finally { setBusy(false); submitting.current = false; }
  };
  const invalidate = () => { setQuote(null); setUncertain(false); setMessage(''); setSuccess(''); };
  const preview = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); invalidate();
    try { setQuote((await api.post<Quote>('/fx/quote', { direction, amount: Number(amount) }, { timeout: 25000 })).data); setNow(Date.now()); }
    catch (error: any) { setMessage(error.response?.data?.message || '환전 견적을 불러오지 못했습니다. 다시 시도해 주세요.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const convert = async () => {
    if (!quote || submitting.current) return;
    submitting.current = true; setBusy(true); setMessage('');
    try {
      const { data } = await api.post<{ receipt: Quote; wallet: Wallet }>('/fx/convert', { quoteId: quote.quoteId }, { timeout: 25000 });
      setWallet(data.wallet); setHistory(previous => [data.receipt, ...previous.filter(item => item.quoteId !== data.receipt.quoteId)].slice(0, 10));
      setSuccess(`${money(data.receipt.sourceAmount, data.receipt.sourceCurrency)} → ${money(data.receipt.targetAmount, data.receipt.targetCurrency)} 환전 완료`);
      setQuote(null); setAmount(''); setUncertain(false);
      for (const market of ['KR', 'US']) window.dispatchEvent(new CustomEvent('antitude:portfolio-updated', { detail: { market, openPanel: false } }));
      window.dispatchEvent(new Event('antitude:fx-converted'));
    } catch (error: any) {
      const pending = !error.response || error.response.status >= 500;
      setUncertain(pending);
      setMessage(pending ? '처리 결과를 확인하지 못했습니다. 아래 버튼으로 같은 환전의 결과를 다시 확인하세요. 중복 환전되지 않습니다.' : error.response?.data?.message || '환전에 실패했습니다.');
    } finally { submitting.current = false; setBusy(false); }
  };
  const expired = quote ? Date.parse(quote.expiresAt) <= now : false;
  const remaining = quote ? Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - now) / 1000)) : 0;
  return <FxContext.Provider value={{ rate, open: () => { void open(); } }}>{children}
    <Modal isOpen={isOpen} initialFocusRef={amountInput} onClose={() => { if (!busy) setOpen(false); }} closeOnOverlayClick={!busy} closeOnEsc={!busy} isCentered scrollBehavior="inside">
      <ModalOverlay /><ModalContent mx="3" bg="app.background"><ModalHeader>원화/달러 환전</ModalHeader><ModalCloseButton isDisabled={busy} />
        <ModalBody><Stack spacing="4">
          <Text fontSize="sm" color="app.subtleText">국내·미국 모의계좌 사이에서 잔액을 옮깁니다. 실제 돈이 출금되거나 환전되지 않습니다.</Text>
          {message && <Alert status="warning" borderRadius="8px"><AlertIcon /><Text fontSize="sm">{message}</Text></Alert>}
          {success && <Alert status="success" borderRadius="8px"><AlertIcon /><Text fontSize="sm">{success}</Text></Alert>}
          {wallet && <Box p="3" bg="white" borderRadius="8px" borderWidth="1px" borderColor="app.borderSoft">
            <Text fontSize="xs" color="app.subtleText">환전 가능한 잔액 · 미체결 주문 예약금 제외</Text>
            <Text mt="1" fontWeight="800">{money(wallet.KRW.availableCash, 'KRW')} / {money(wallet.USD.availableCash, 'USD')}</Text>
          </Box>}
          <FormControl><FormLabel fontSize="sm" htmlFor="fx-direction">환전 방향</FormLabel><Select id="fx-direction" value={direction} isDisabled={busy || uncertain} onChange={event => { setDirection(event.target.value as Direction); setAmount(''); invalidate(); }}>
            <option value="KRW_TO_USD">원화 → 달러</option><option value="USD_TO_KRW">달러 → 원화</option>
          </Select></FormControl>
          <FormControl><FormLabel fontSize="sm" htmlFor="fx-amount">환전할 금액 ({source === 'KRW' ? '원' : '달러'})</FormLabel>
            <Flex gap="2"><Input ref={amountInput} id="fx-amount" type="number" inputMode={source === 'KRW' ? 'numeric' : 'decimal'} min={source === 'KRW' ? 1 : 0.01} step={source === 'KRW' ? 1 : 0.01} value={amount} isDisabled={busy || uncertain} placeholder={source === 'KRW' ? '예: 100000' : '예: 100.00'} onChange={event => { setAmount(event.target.value); invalidate(); }} />
              <Button variant="outline" isDisabled={busy || !wallet || uncertain} onClick={() => { setAmount(String(wallet?.[source].availableCash || 0)); invalidate(); }}>전액</Button></Flex>
          </FormControl>
          {quote && <Box p="4" bg="orange.50" borderRadius="8px" role="status">
            <Text fontSize="sm">{money(quote.sourceAmount, quote.sourceCurrency)} 환전 시 받는 금액</Text><Text mt="1" fontSize="2xl" fontWeight="900">{money(quote.targetAmount, quote.targetCurrency)}</Text>
            <Text mt="2" fontSize="xs">적용 환율: 1 USD = {quote.rate.toLocaleString('ko-KR')}원</Text>
            <Text fontSize="xs">{quote.rateDate} 기준 · {quote.rateSource}</Text>
            <Text mt="2" fontSize="xs" color={expired ? 'red.700' : 'app.subtleText'}>{expired ? '견적이 만료됐어요. 다시 확인해 주세요.' : `견적 유효시간 ${remaining}초`}</Text>
          </Box>}
          <Text fontSize="xs" color="app.subtleText">모의환전 수수료는 0원입니다. 받는 금액은 원화 1원·달러 0.01달러 미만을 버립니다. 은행의 실제 매매 환율과 다를 수 있습니다.</Text>
          {rate && !quote && <Text fontSize="xs" color="app.subtleText">{rate.date} 기준 · {rate.source}{rate.stale ? ' · 최신 조회 실패로 환전 일시 중단' : ''}</Text>}
          {history.length > 0 && <Box borderTopWidth="1px" borderColor="app.borderSoft" pt="3"><Text fontSize="sm" fontWeight="800">최근 환전 내역</Text>
            {history.slice(0, 5).map(item => <Box key={item.quoteId} mt="2"><Text fontSize="sm">{money(item.sourceAmount, item.sourceCurrency)} → {money(item.targetAmount, item.targetCurrency)}</Text><Text fontSize="10px" color="app.subtleText">{new Date(item.createdAt).toLocaleString('ko-KR')} · 1 USD = {item.rate.toLocaleString('ko-KR')}원</Text></Box>)}
          </Box>}
        </Stack></ModalBody>
        <ModalFooter gap="2"><Button variant="ghost" isDisabled={busy} onClick={() => setOpen(false)}>닫기</Button>
          {quote && (!expired || uncertain) ? <Button ref={actionButton} colorScheme="orange" isLoading={busy} onClick={() => void convert()}>{uncertain ? '환전 결과 다시 확인' : '이 금액으로 환전'}</Button>
            : <Button ref={actionButton} colorScheme="orange" isLoading={busy} isDisabled={!wallet || !(Number(amount) > 0)} onClick={() => void preview()}>환전 금액 확인</Button>}
        </ModalFooter>
      </ModalContent>
    </Modal>
  </FxContext.Provider>;
}
