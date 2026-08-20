import React, { useMemo, useState } from "react";
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

type AiFactor = {
  label: "직접" | "간접";
  factor: string;
  weight: number;
  description: string;
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

function recentReturn(points: ChartPointLike[], count = 12) {
  const recent = points.slice(-count);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || first.close <= 0) return 0;
  return ((last.close - first.close) / first.close) * 100;
}

function volatility(points: ChartPointLike[]) {
  const recent = points.slice(-12);
  if (recent.length < 2) return 0;

  const returns = recent.slice(1).map((item, index) => {
    const previous = recent[index];
    if (!previous || previous.close <= 0) return 0;
    return ((item.close - previous.close) / previous.close) * 100;
  });

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    returns.length;
  return Math.sqrt(variance);
}

function getDecision(stock: StockLike | null, points: ChartPointLike[]): AiDecision {
  if (!stock) return "관망";
  const r = recentReturn(points);
  const score = stock.changeRate * 0.65 + r * 0.35;
  if (score >= 2.5) return "매수";
  if (score <= -2.5) return "매도";
  return "관망";
}

function getFactors(stock: StockLike | null, points: ChartPointLike[]): AiFactor[] {
  if (!stock) {
    return [
      {
        label: "직접",
        factor: "선택 종목 정보",
        weight: 0,
        description: "종목을 선택하면 판단 요인을 분석합니다.",
      },
    ];
  }

  const r = recentReturn(points, 10);
  const v = volatility(points);
  const recent = points.slice(-10);
  const avgVolume =
    recent.length > 0
      ? recent.reduce((sum, item) => sum + Number(item.volume ?? 0), 0) /
        recent.length
      : 0;
  const ratio = avgVolume > 0 ? Number(stock.volume ?? 0) / avgVolume : 1;

  return [
    {
      label: "직접",
      factor: stock.changeRate >= 0 ? "현재가 상승 흐름" : "현재가 하락 압력",
      weight: Math.min(95, Math.max(35, Math.round(Math.abs(stock.changeRate) * 8))),
      description: `현재 등락률 ${stock.changeRate >= 0 ? "+" : ""}${stock.changeRate.toFixed(2)}%를 반영했습니다.`,
    },
    {
      label: "직접",
      factor: r >= 0 ? "단기 차트 반등 흐름" : "단기 차트 약세 흐름",
      weight: Math.min(95, Math.max(35, Math.round(Math.abs(r) * 10))),
      description: `최근 구간 가격 변화율 ${r >= 0 ? "+" : ""}${r.toFixed(2)}%입니다.`,
    },
    {
      label: "간접",
      factor: "거래량 기반 수급 강도",
      weight: Math.min(92, Math.max(30, Math.round(ratio * 48))),
      description:
        ratio >= 1
          ? "최근 평균보다 거래가 활발한 구간입니다."
          : "최근 평균 대비 거래량이 제한적인 구간입니다.",
    },
    {
      label: "간접",
      factor: "단기 변동성 리스크",
      weight: Math.min(90, Math.max(30, Math.round(v * 22 + 30))),
      description: `최근 단기 변동성 지표는 약 ${v.toFixed(2)} 수준입니다.`,
    },
  ];
}

function FactorCard({ factor }: { factor: AiFactor }) {
  const direct = factor.label === "직접";
  const accent = direct ? "#F05B45" : "#E7A31C";

  return (
    <Box p="12px" bg="white" borderWidth="1px" borderColor={BORDER} borderRadius="10px">
      <Flex align="center" gap="8px">
        <Badge
          px="7px"
          py="2px"
          borderRadius="5px"
          fontSize="9px"
          bg={direct ? "#FFF0ED" : "#FFF7E2"}
          color={accent}
        >
          {factor.label}
        </Badge>
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

      <Text mt="8px" fontSize="9px" lineHeight="1.6" color={MUTED}>
        {factor.description}
      </Text>
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

  const aiDecision = useMemo(
    () => getDecision(stock, chartPoints),
    [stock, chartPoints],
  );

  const factors = useMemo(
    () => getFactors(stock, chartPoints),
    [stock, chartPoints],
  );

  const confidence = useMemo(() => {
    const average =
      factors.reduce((sum, item) => sum + item.weight, 0) /
      Math.max(factors.length, 1);
    return Math.min(93, Math.max(45, Math.round(average)));
  }, [factors]);

  const summary = useMemo(() => {
    if (!stock) return "종목을 선택하면 AI 판단을 확인할 수 있습니다.";
    const r = recentReturn(chartPoints);

    if (aiDecision === "매수") {
      return `${stock.name}은 현재 등락률과 단기 차트 흐름이 우호적으로 나타납니다. 다만 단기 상승 이후 변동성 확대 가능성은 함께 확인할 필요가 있습니다.`;
    }
    if (aiDecision === "매도") {
      return `${stock.name}은 현재 가격 흐름과 단기 차트가 약세 방향을 보이고 있습니다. 추가 하락 가능성과 변동성 리스크를 함께 고려할 필요가 있습니다.`;
    }
    return `${stock.name}은 현재 방향성이 뚜렷하지 않습니다. 최근 차트 변화율은 ${r.toFixed(2)}% 수준으로 추가 신호 확인 전까지 관망 판단이 상대적으로 우세합니다.`;
  }, [aiDecision, stock, chartPoints]);

  const history = useMemo(
    () => [
      { time: "09:30", decision: "관망" as AiDecision, reason: "장 초반 방향성 확인 필요" },
      { time: "10:15", decision: aiDecision, reason: "현재가와 단기 차트 흐름 반영" },
      { time: "11:00", decision: aiDecision, reason: "거래량과 변동성 요인 재확인" },
    ],
    [aiDecision],
  );

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
          </Stack>
        )}

        {tab === "히스토리" && (
          <Stack spacing="0">
            <Box mb="12px" p="11px" bg={ORANGE_SOFT} borderRadius="9px">
              <Text fontSize="10px" fontWeight="800" color="#7A4E31">
                시간에 따라 AI 판단이 어떻게 변했는지 확인할 수 있습니다.
              </Text>
            </Box>
            {history.map((item, index) => (
              <Flex key={`${item.time}-${index}`} gap="11px" minH="78px">
                <Flex direction="column" align="center">
                  <Box mt="4px" w="9px" h="9px" borderRadius="full" bg={decisionColor(item.decision)} />
                  {index < history.length - 1 && <Box mt="5px" w="1px" flex="1" bg="#E8DED3" />}
                </Flex>
                <Box flex="1" pb="14px">
                  <Flex align="center">
                    <Text fontSize="9px" color={MUTED}>{item.time}</Text>
                    <Spacer />
                    <Badge bg={decisionBg(item.decision)} color={decisionColor(item.decision)} fontSize="8px">
                      {item.decision}
                    </Badge>
                  </Flex>
                  <Text mt="7px" fontSize="10px" fontWeight="800" color={TEXT}>
                    {item.reason}
                  </Text>
                </Box>
              </Flex>
            ))}
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
                    onClick={() => setUserDecision(decision)}
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
                <Text fontSize="10px" fontWeight="900" color={TEXT}>
                  {userDecision === aiDecision
                    ? "AI와 같은 방향으로 판단했습니다."
                    : "AI와 다른 방향으로 판단했습니다."}
                </Text>
                <Text mt="5px" fontSize="9px" lineHeight="1.65" color={MUTED}>
                  정답/오답 비교가 아니라 어떤 요인을 다르게 해석했는지 확인하는 학습용 비교입니다.
                </Text>
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}