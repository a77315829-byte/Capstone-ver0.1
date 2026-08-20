import React, { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Progress,
  SimpleGrid,
  Spacer,
  Stack,
  Text,
} from "@chakra-ui/react";
import judgmentService, {
  type AiCompareResult,
  type AiHistoryEntry,
  type AiJudgment,
  type AiJudgmentFactor,
} from "../services/judgment.service";

type AiDecision = "매수" | "매도" | "관망";

type StockLike = {
  symbol: string;
  name: string;
  price: number;
  changeRate: number;
  changePrice?: number;
  volume?: number;
};

type ChartPointLike = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  stock: StockLike | null;
  chartPoints: ChartPointLike[];
  chartPeriod: string;
  chartInterval: string;
};

const ORANGE = "#F36F2A";
const ORANGE_SOFT = "#FFF4EC";
const BORDER = "#E8DCCE";
const TEXT = "#2B251F";
const MUTED = "#8C8177";

function decisionColor(decision: AiDecision) {
  if (decision === "매수") return "#E85B47";
  if (decision === "매도") return "#3C70D8";
  return "#E28A2F";
}

function decisionBg(decision: AiDecision) {
  if (decision === "매수") return "#FFF1EF";
  if (decision === "매도") return "#EEF4FF";
  return "#FFF6E9";
}

function formatHistoryTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function factorAccent(direction?: "긍정" | "부정" | null) {
  if (direction === "긍정") return "#F05B45";
  if (direction === "부정") return "#3C70D8";
  return "#B1A79E";
}

function FactorCard({ factor }: { factor: AiJudgmentFactor }) {
  const accent = factorAccent(factor.direction);

  return (
    <Box p="12px" bg="white" borderWidth="1px" borderColor={BORDER} borderRadius="10px">
      <Flex align="center" gap="8px">
        {factor.direction && (
          <Badge
            px="7px"
            py="2px"
            borderRadius="5px"
            fontSize="9px"
            bg={`${accent}1A`}
            color={accent}
          >
            {factor.direction}
          </Badge>
        )}
        <Text flex="1" fontSize="11px" fontWeight="900" color={TEXT} noOfLines={1}>
          {factor.factor}
        </Text>
        <Text fontSize="11px" fontWeight="900" color={MUTED}>
          {factor.weight}%
        </Text>
      </Flex>

      <Progress
        mt="9px"
        value={factor.weight}
        h="4px"
        borderRadius="full"
        bg="#F0EBE6"
        sx={{ "& > div": { background: accent, borderRadius: "999px" } }}
      />
    </Box>
  );
}

export default function AiRamenPanel({
  isOpen,
  onClose,
  stock,
  chartPoints,
  chartPeriod,
  chartInterval,
}: Props) {
  const [tab, setTab] = useState<"판단근거" | "히스토리" | "비교">("판단근거");
  const [userDecision, setUserDecision] = useState<AiDecision | null>(null);

  const [judgment, setJudgment] = useState<AiJudgment | null>(null);
  const [isLoadingJudgment, setIsLoadingJudgment] = useState(false);
  const [history, setHistory] = useState<AiHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 지금 보고 있는 종목만 백엔드가 실시간으로 감시하도록, 패널이 열려 있는 동안
  // 주기적으로 구독을 갱신(하트비트)하고 종목이 바뀌거나 패널을 닫으면 해제한다.
  // 최초 구독(콜드스타트 포함)이 끝날 때까지 기다렸다가 판단·히스토리를 불러와야
  // "이력이 아직 없다"는 응답을 콜드스타트 완료 전에 잘못 받는 걸 피할 수 있다.
  useEffect(() => {
    if (!isOpen || !stock?.symbol) {
      setJudgment(null);
      setHistory([]);
      return;
    }

    const symbol = stock.symbol;
    let cancelled = false;
    setIsLoadingJudgment(true);
    setIsLoadingHistory(true);

    judgmentService
      .watchSymbol(symbol)
      .catch(() => {})
      .then(() =>
        Promise.all([
          judgmentService.getJudgment(symbol).catch(() => null),
          judgmentService.getHistory(symbol).catch(() => []),
        ]),
      )
      .then(([judgmentResult, historyResult]) => {
        if (cancelled) return;
        setJudgment(judgmentResult);
        setHistory(historyResult);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingJudgment(false);
          setIsLoadingHistory(false);
        }
      });

    const heartbeat = setInterval(() => {
      void judgmentService.watchSymbol(symbol);
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      void judgmentService.unwatchSymbol(symbol);
    };
  }, [isOpen, stock?.symbol]);

  const aiDecision: AiDecision = judgment?.judge ?? "관망";
  const confidence = judgment?.confidence ?? 0;
  const factors = judgment?.factors ?? [];
  const summary = isLoadingJudgment
    ? "AI 판단을 불러오는 중입니다..."
    : judgment?.summary ??
      (stock ? "아직 계산된 판단이 없습니다." : "종목을 선택하면 AI 판단을 확인할 수 있습니다.");

  const [compareResult, setCompareResult] = useState<AiCompareResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const handleSelectDecision = (decision: AiDecision) => {
    setUserDecision(decision);
    setCompareResult(null);
    if (!stock?.symbol) return;

    setIsComparing(true);
    judgmentService
      .compare(stock.symbol, decision)
      .then((result) => setCompareResult(result))
      .catch(() => setCompareResult(null))
      .finally(() => setIsComparing(false));
  };

  if (!isOpen) return null;

  return (
    <Box
      w="100%"
      minW="0"
      bg="#FFFCF8"
      borderWidth="1px"
      borderColor={BORDER}
      borderRadius="12px"
      overflow="hidden"
      boxShadow="0 10px 28px rgba(73,52,30,.08)"
    >
      <Box px="16px" pt="16px" pb="14px" bg="white" borderBottomWidth="1px" borderColor={BORDER}>
        <Flex align="center">
          <Box>
            <Text fontSize="15px" fontWeight="900" color={TEXT} letterSpacing="-0.03em">
              AI 라면?
            </Text>
            <Text mt="2px" fontSize="9px" color={MUTED}>
              {stock ? `${stock.name} · ${stock.symbol}` : "선택 종목 없음"}
            </Text>
          </Box>
          <Spacer />
          <Button size="xs" variant="ghost" color={ORANGE} fontSize="18px" onClick={onClose}>
            ←
          </Button>
        </Flex>

        <Box
          mt="13px"
          p="13px 14px"
          borderRadius="10px"
          bg={decisionBg(aiDecision)}
          borderWidth="1px"
          borderColor={`${decisionColor(aiDecision)}35`}
        >
          <Flex align="flex-end">
            <Box>
              <Text fontSize="9px" color={MUTED}>현재 판단</Text>
              <Text mt="3px" fontSize="22px" fontWeight="900" color={decisionColor(aiDecision)}>
                {aiDecision}
              </Text>
            </Box>
            <Spacer />
            <Box textAlign="right">
              <Text fontSize="9px" color={MUTED}>신뢰도</Text>
              <Text mt="3px" fontSize="18px" fontWeight="900" color={decisionColor(aiDecision)}>
                {confidence}%
              </Text>
            </Box>
          </Flex>
          <Progress
            mt="9px"
            value={confidence}
            h="4px"
            borderRadius="full"
            bg="rgba(255,255,255,.75)"
            sx={{
              "& > div": {
                background: decisionColor(aiDecision),
                borderRadius: "999px",
              },
            }}
          />
        </Box>
      </Box>

      <Grid templateColumns="repeat(3,1fr)" bg="white" borderBottomWidth="1px" borderColor={BORDER}>
        {(["판단근거", "히스토리", "비교"] as const).map((item) => (
          <Button
            key={item}
            h="42px"
            variant="ghost"
            borderRadius="0"
            fontSize="10px"
            fontWeight={tab === item ? "900" : "700"}
            color={tab === item ? TEXT : "#B1A79E"}
            borderBottomWidth="2px"
            borderBottomColor={tab === item ? ORANGE : "transparent"}
            onClick={() => setTab(item)}
          >
            {item}
          </Button>
        ))}
      </Grid>

      <Box p="12px" maxH="650px" overflowY="auto">
        {tab === "판단근거" && (
          <Stack spacing="10px">
            <Box p="12px" bg="#F8F5F1" borderRadius="9px">
              <Text fontSize="10px" lineHeight="1.75" color="#625950">
                {summary}
              </Text>
            </Box>
            <Flex px="2px">
              <Text fontSize="9px" color={MUTED}>차트 기준</Text>
              <Spacer />
              <Text fontSize="9px" fontWeight="800" color="#73685F">
                {chartPeriod} / {chartInterval}
              </Text>
            </Flex>
            {factors.map((factor) => (
              <FactorCard key={factor.factor} factor={factor} />
            ))}
            {!isLoadingJudgment && factors.length === 0 && (
              <Text fontSize="10px" color={MUTED} textAlign="center" py="12px">
                지금은 특별한 신호가 감지되지 않았어요.
              </Text>
            )}
          </Stack>
        )}

        {tab === "히스토리" && (
          <Stack spacing="0">
            <Box mb="12px" p="11px" bg={ORANGE_SOFT} borderRadius="9px">
              <Text fontSize="10px" fontWeight="800" color="#7A4E31">
                시간에 따라 AI 판단이 어떻게 변했는지 확인할 수 있습니다.
              </Text>
            </Box>
            {isLoadingHistory ? (
              <Text fontSize="10px" color={MUTED} textAlign="center" py="24px">
                불러오는 중...
              </Text>
            ) : history.length === 0 ? (
              <Text fontSize="10px" color={MUTED} textAlign="center" py="24px">
                아직 판단 이력이 없습니다.
              </Text>
            ) : (
              history.map((item, index) => (
                <Flex key={`${item.time}-${index}`} gap="11px" minH="78px">
                  <Flex direction="column" align="center">
                    <Box mt="4px" w="9px" h="9px" borderRadius="full" bg={decisionColor(item.judge)} />
                    {index < history.length - 1 && <Box mt="5px" w="1px" flex="1" bg="#E8DED3" />}
                  </Flex>
                  <Box flex="1" pb="14px">
                    <Flex align="center">
                      <Text fontSize="9px" color={MUTED}>{formatHistoryTime(item.time)}</Text>
                      <Spacer />
                      <Badge bg={decisionBg(item.judge)} color={decisionColor(item.judge)} fontSize="8px">
                        {item.judge}
                      </Badge>
                    </Flex>
                    <Text mt="7px" fontSize="10px" fontWeight="800" color={TEXT}>
                      {item.reason}
                    </Text>
                  </Box>
                </Flex>
              ))
            )}
          </Stack>
        )}

        {tab === "비교" && (
          <Stack spacing="12px">
            <Box p="12px" bg="white" borderWidth="1px" borderColor={BORDER} borderRadius="10px">
              <Text fontSize="11px" fontWeight="900" color={TEXT}>내 판단을 선택해보세요</Text>
              <Text mt="3px" fontSize="9px" color={MUTED}>AI 판단과 내 판단의 차이를 비교합니다.</Text>
              <SimpleGrid mt="11px" columns={3} spacing="7px">
                {(["매수", "관망", "매도"] as AiDecision[]).map((decision) => (
                  <Button
                    key={decision}
                    size="sm"
                    h="33px"
                    variant="outline"
                    borderColor={userDecision === decision ? decisionColor(decision) : BORDER}
                    bg={userDecision === decision ? decisionBg(decision) : "white"}
                    color={decisionColor(decision)}
                    fontSize="10px"
                    onClick={() => handleSelectDecision(decision)}
                  >
                    {decision}
                  </Button>
                ))}
              </SimpleGrid>
            </Box>

            <Grid templateColumns="1fr 30px 1fr" gap="6px" alignItems="stretch">
              <Box p="12px" textAlign="center" bg="white" borderWidth="1px" borderColor={BORDER} borderRadius="10px">
                <Text fontSize="9px" color={MUTED}>내 판단</Text>
                <Text mt="7px" fontSize="18px" fontWeight="900" color={userDecision ? decisionColor(userDecision) : "#B4AAA1"}>
                  {userDecision ?? "-"}
                </Text>
              </Box>
              <Flex align="center" justify="center" fontSize="9px" fontWeight="900" color="#B4AAA1">VS</Flex>
              <Box p="12px" textAlign="center" bg="white" borderWidth="1px" borderColor={BORDER} borderRadius="10px">
                <Text fontSize="9px" color={MUTED}>AI 판단</Text>
                <Text mt="7px" fontSize="18px" fontWeight="900" color={decisionColor(aiDecision)}>
                  {aiDecision}
                </Text>
              </Box>
            </Grid>

            {userDecision && (
              <Box p="12px" bg={userDecision === aiDecision ? "#F2F9F2" : "#FFF7ED"} borderRadius="10px">
                {isComparing ? (
                  <Text fontSize="10px" color={MUTED}>비교 결과를 불러오는 중...</Text>
                ) : compareResult ? (
                  <>
                    <Text fontSize="10px" fontWeight="900" color={TEXT}>
                      {userDecision === compareResult.ai_judge
                        ? "AI와 같은 방향으로 판단했습니다."
                        : "AI와 다른 방향으로 판단했습니다."}
                    </Text>
                    <Text mt="5px" fontSize="9px" lineHeight="1.65" color={MUTED}>
                      {compareResult.explanation}
                    </Text>
                  </>
                ) : (
                  <Text fontSize="10px" color={MUTED}>비교 결과를 불러오지 못했습니다.</Text>
                )}
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}