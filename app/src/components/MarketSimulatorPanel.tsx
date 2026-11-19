import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  CloseButton,
  Flex,
  Grid,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  Portal,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  useDisclosure,
  useToast,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import api from "../services/api.service";
import tokens from "../services/tokens.service";
import { streamMarketSimulation } from "../services/marketSimulationStream";
import type {
  SimulationAggregate,
  SimulationAgent,
  SimulationContext,
  SimulationProgress,
  SimulationResult,
} from "../services/marketSimulationStream";

type StockLike = {
  symbol: string;
  name: string;
  price: number;
  changeRate: number;
  volume?: number;
};

type InputTypeHint =
  | "real_news"
  | "company_information"
  | "industry_information"
  | "hypothetical_scenario";

type Props = {
  stock: StockLike | null;
  displayMode?: "floating" | "page";
  isOpen?: boolean;
  onClose?: () => void;
  showTrigger?: boolean;
};

const ORANGE = "#F36F2A";
const ORANGE_DARK = "#DE5D1F";
const ORANGE_SOFT = "#FFF4EC";
const BORDER = "#E8DCCE";
const TEXT = "#29231E";
const MUTED = "#887D73";
const BACKGROUND = "#FDFAF4";

const inputTypeOptions: { value: InputTypeHint; label: string }[] = [
  { value: "real_news", label: "뉴스/이벤트" },
  { value: "company_information", label: "기업 공시" },
  { value: "industry_information", label: "산업 정보" },
  { value: "hypothetical_scenario", label: "가정 시나리오" },
];

const sampleInputs = [
  "삼성전자가 차세대 HBM 공급 확대 계획을 발표했다.",
  "미국의 기준금리 인하 기대감이 확대되고 있다.",
  "반도체 업황 회복으로 메모리 가격 상승 전망이 나왔다.",
];

const directionKoMap: Record<string, string> = {
  positive: "긍정",
  negative: "부정",
  neutral: "중립",
  buy: "매수",
  sell: "매도",
  hold: "관망",
};

const strengthKoMap: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

const timeHorizonKoMap: Record<string, string> = {
  short_term: "단기",
  mid_term: "중기",
  long_term: "장기",
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normalizeConfidence(value?: number) {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return 0;
  return score <= 1 ? score * 100 : score;
}

function toneColor(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("positive") || normalized.includes("buy")) return "#E85B47";
  if (normalized.includes("negative") || normalized.includes("sell")) return "#3C70D8";
  return "#E28A2F";
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Box bg="white" borderWidth="1px" borderColor={BORDER} borderRadius="12px" p={{ base: "16px", md: "18px" }}>
      <Text fontSize="13px" fontWeight="900" color={TEXT}>{title}</Text>
      {subtitle && <Text mt="2px" fontSize="10px" color={MUTED}>{subtitle}</Text>}
      <Box mt="14px">{children}</Box>
    </Box>
  );
}

function PressureBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box>
      <Flex mb="5px" justify="space-between">
        <Text fontSize="10px" color={MUTED}>{label}</Text>
        <Text fontSize="10px" fontWeight="900" color={color}>{Math.round(value)}%</Text>
      </Flex>
      <Progress
        value={clampPercent(value)}
        h="5px"
        bg="#F0EBE6"
        borderRadius="full"
        sx={{ "& > div": { background: color, borderRadius: "999px" } }}
      />
    </Box>
  );
}

type IntermediateAnalysis = {
  progress: SimulationProgress | null;
  context: SimulationContext | null;
  agents: SimulationAgent[];
  aggregate: SimulationAggregate | null;
};

const emptyIntermediate: IntermediateAnalysis = { progress: null, context: null, agents: [], aggregate: null };
const stageLabels: Record<SimulationProgress["stage"], string> = {
  quote: "현재 종목 정보를 확인하고 있습니다.",
  validating: "입력 내용을 확인하고 있습니다.",
  context: "입력 영향과 종목 정보를 분석하고 있습니다.",
  agents: "시장 참여자별 반응을 분석하고 있습니다.",
  review: "참여자 반응을 교차 검토하고 있습니다.",
  summary: "종합 해설을 작성하고 있습니다.",
};

function IntermediateView({
  analysis,
  elapsedSeconds,
  onCancel,
}: {
  analysis: IntermediateAnalysis;
  elapsedSeconds: number;
  onCancel: () => void;
}) {
  const impact = analysis.context?.impact_analysis;
  const context = analysis.context?.current_stock_context;
  const pressure = analysis.aggregate?.market_pressure;
  const sentiment = analysis.aggregate?.market_sentiment;
  const lastAgent = analysis.agents[analysis.agents.length - 1];

  return (
    <Stack spacing="14px" aria-busy="true">
      <Box p="16px" bg="white" borderWidth="1px" borderColor={BORDER} borderRadius="12px">
        <Flex align="center" gap="12px" role="status" aria-live="polite">
          <Spinner size="md" color={ORANGE} thickness="3px" flexShrink={0} />
          <Box flex="1">
            <Text fontSize="12px" fontWeight="800" color={TEXT}>
              {analysis.progress?.message || (analysis.progress ? stageLabels[analysis.progress.stage] : "분석 서버에 연결하고 있습니다.")}
            </Text>
            <Text mt="4px" fontSize="10px" color={MUTED}>{elapsedSeconds}초 경과</Text>
          </Box>
          <Button size="sm" variant="outline" borderColor={BORDER} onClick={onCancel}>분석 취소</Button>
        </Flex>
        <Text mt="12px" fontSize="11px" fontWeight="800" color={ORANGE_DARK}>
          분석 중 · 최종 결과가 달라질 수 있음
        </Text>
        <Text mt="4px" fontSize="10px" color={MUTED}>완료된 분석부터 표시합니다. 최종 신뢰도와 종합 해설은 분석 완료 후 제공됩니다.</Text>
      </Box>

      {analysis.context && (
        <SectionCard title="입력 영향 분석 · 중간 결과">
          {analysis.context.fallback_used && <Badge mb="10px" bg="#F6EFE8" color="#75685C">기본 규칙</Badge>}
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing="10px">
            {[
              { label: "영향 방향", value: impact?.impact_direction_ko ?? directionKoMap[impact?.impact_direction ?? ""] },
              { label: "영향 강도", value: impact?.impact_strength_ko ?? strengthKoMap[impact?.impact_strength ?? ""] },
              { label: "예상 기간", value: impact?.time_horizon_ko ?? timeHorizonKoMap[impact?.time_horizon ?? ""] },
              { label: "관련 산업", value: impact?.related_industries?.join(", ") },
            ].map((item) => (
              <Box key={item.label} p="10px" bg="#FFFCF8" borderRadius="9px">
                <Text fontSize="9px" color={MUTED}>{item.label}</Text>
                <Text mt="5px" fontSize="11px" fontWeight="800" color={TEXT}>{item.value || "정보 없음"}</Text>
              </Box>
            ))}
          </SimpleGrid>
          {context && (
            <Text mt="12px" fontSize="10px" color={MUTED}>
              {context.name || "선택 종목"}{context.industry ? ` · ${context.industry}` : ""}
              {typeof context.current_price === "number" ? ` · 기준 가격 ${context.current_price.toLocaleString("ko-KR")}원` : ""}
            </Text>
          )}
        </SectionCard>
      )}

      {lastAgent && (
        <SectionCard title={`시장 참여자별 중간 반응 · ${analysis.agents.length}/${lastAgent.total_agents}명 완료`} subtitle="응답이 도착한 순서로 표시합니다.">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing="10px">
            {analysis.agents.map(({ agent, fallback_used }, index) => (
              <Box key={agent.agent_type ?? String(index)} p="12px" bg="#FFFCF8" borderWidth="1px" borderColor="#F0E7DE" borderRadius="10px">
                <Flex align="center" gap="6px" wrap="wrap">
                  <Text fontSize="11px" fontWeight="900" color={TEXT}>{agent.agent_name_ko ?? agent.agent_type ?? "시장 참여자"}</Text>
                  {fallback_used && <Badge bg="#F6EFE8" color="#75685C" fontSize="8px">기본 규칙</Badge>}
                  <Box flex="1" />
                  <Badge bg="#F6EFE8" color={toneColor(agent.reaction_direction)} fontSize="8px">
                    {agent.reaction_direction_ko ?? directionKoMap[agent.reaction_direction ?? ""] ?? "정보 없음"}
                  </Badge>
                </Flex>
                <Text mt="9px" fontSize="10px" lineHeight="1.6" color="#675D54">
                  {agent.comment ?? agent.key_reasons?.[0] ?? "세부 반응 설명이 없습니다."}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </SectionCard>
      )}

      {analysis.aggregate && (
        <SectionCard title="검토 후 시장 반응 · 중간 결과">
          <Stack spacing="12px">
            {[
              { label: "매수 압력", value: pressure?.buy, color: "#E85B47" },
              { label: "매도 압력", value: pressure?.sell, color: "#3C70D8" },
              { label: "관망 가능성", value: pressure?.hold, color: "#9B948C" },
            ].map(({ label, value, color }) => typeof value === "number" && Number.isFinite(value) ? (
              <PressureBar key={label} label={label} value={value} color={color} />
            ) : null)}
            {pressure?.headline && <Text fontSize="10px" lineHeight="1.65" color="#675D54">{pressure.headline}</Text>}
            {sentiment?.label_ko && <Text fontSize="11px" fontWeight="800" color={toneColor(sentiment.code)}>{sentiment.label_ko}</Text>}
            {sentiment?.one_liner && <Text fontSize="10px" lineHeight="1.65" color="#675D54">{sentiment.one_liner}</Text>}
            {analysis.aggregate.uncertainty_factors?.map((item, index) => (
              <Text key={`${item}-${index}`} fontSize="10px" color={MUTED}>• {item}</Text>
            ))}
          </Stack>
        </SectionCard>
      )}
    </Stack>
  );
}

function ResultView({
  result,
  onReset,
  onClose,
}: {
  result: SimulationResult;
  onReset: () => void;
  onClose: () => void;
}) {
  const impact = result.impact_analysis;
  const pressure = result.market_pressure;
  const sentiment = result.market_sentiment;
  const confidence = result.analysis_confidence;
  const buy = clampPercent(Number(pressure?.buy ?? 0));
  const sell = clampPercent(Number(pressure?.sell ?? 0));
  const hold = clampPercent(Number(pressure?.hold ?? 0));
  const confidenceScore = clampPercent(normalizeConfidence(confidence?.score));

  const agents = useMemo(() => {
    const order = ["retail", "foreign", "institution", "short_term", "long_term"];
    return [...(result.agent_reactions ?? [])].sort(
      (a, b) => order.indexOf(a.agent_type ?? "") - order.indexOf(b.agent_type ?? ""),
    );
  }, [result.agent_reactions]);

  return (
    <Stack spacing="14px">
      <Flex align={{ base: "stretch", md: "center" }} direction={{ base: "column", md: "row" }} gap="10px">
        <Box>
          <Badge bg={ORANGE_SOFT} color={ORANGE_DARK} borderRadius="full" px="9px" py="4px" fontSize="9px">
            AI 시장 반응 분석 완료
          </Badge>
          <Heading mt="8px" size="sm" color={TEXT}>
            {result.selected_stock?.name ?? result.current_stock_context?.name ?? "선택 종목"} 시장 반응 분석
          </Heading>
        </Box>
        <Box flex="1" />
        <HStack>
          <Button size="sm" variant="outline" borderColor={BORDER} onClick={onReset}>새 분석</Button>
          <Button size="sm" bg={ORANGE} color="white" _hover={{ bg: ORANGE_DARK }} onClick={onClose}>확인</Button>
        </HStack>
      </Flex>

      <SectionCard title="영향 분석" subtitle="입력한 이벤트가 선택 종목에 미칠 가능성">
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing="12px">
          {[
            {
              label: "영향 방향",
              value: impact?.impact_direction_ko ?? directionKoMap[impact?.impact_direction ?? ""] ?? "정보 없음",
              color: toneColor(impact?.impact_direction),
            },
            {
              label: "영향 강도",
              value: impact?.impact_strength_ko ?? strengthKoMap[impact?.impact_strength ?? ""] ?? "정보 없음",
            },
            {
              label: "예상 기간",
              value: impact?.time_horizon_ko ?? timeHorizonKoMap[impact?.time_horizon ?? ""] ?? "정보 없음",
            },
            {
              label: "관련 산업",
              value: impact?.related_industries?.join(", ") || "정보 없음",
            },
          ].map((item) => (
            <Box key={item.label} p="12px" bg="#FFFCF8" borderRadius="9px" borderWidth="1px" borderColor="#F0E7DE">
              <Text fontSize="9px" color={MUTED}>{item.label}</Text>
              <Text mt="6px" fontSize="12px" fontWeight="900" color={item.color ?? TEXT}>{item.value}</Text>
            </Box>
          ))}
        </SimpleGrid>

        {impact?.key_keywords?.length ? (
          <Wrap mt="12px">
            {impact.key_keywords.map((keyword) => (
              <WrapItem key={keyword}>
                <Badge bg="#F6EFE8" color="#75685C" borderRadius="full" px="8px" py="3px" fontSize="9px">
                  #{keyword}
                </Badge>
              </WrapItem>
            ))}
          </Wrap>
        ) : null}
      </SectionCard>

      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap="14px">
        <SectionCard title="시장 압력" subtitle="매수·매도·관망 성향 분포">
          <Stack spacing="12px">
            <PressureBar label="매수 압력" value={buy} color="#E85B47" />
            <PressureBar label="매도 압력" value={sell} color="#3C70D8" />
            <PressureBar label="관망 가능성" value={hold} color="#9B948C" />
          </Stack>
          {pressure?.headline && <Text mt="13px" fontSize="10px" lineHeight="1.65" color="#675D54">{pressure.headline}</Text>}
        </SectionCard>

        <SectionCard title="시장 분위기" subtitle="시장 반응의 전반적인 성향">
          <Badge bg={ORANGE_SOFT} color={toneColor(sentiment?.code)} borderRadius="full" px="9px" py="4px">
            {sentiment?.label_ko ?? "정보 없음"}
          </Badge>
          <Box mt="14px" h="7px" borderRadius="full" bgGradient="linear(to-r, #7FA3EA, #DDD8D2, #F08A7A)" />
          <Flex mt="7px" justify="space-between">
            <Text fontSize="9px" color="#5278C8">부정적</Text>
            <Text fontSize="9px" color={MUTED}>중립</Text>
            <Text fontSize="9px" color="#D85D4E">긍정적</Text>
          </Flex>
          <Text mt="13px" fontSize="10px" lineHeight="1.65" color="#675D54">
            {sentiment?.one_liner ?? "시장 분위기 설명이 제공되지 않았습니다."}
          </Text>
        </SectionCard>

        <SectionCard title="시장 신뢰도">
          <Flex align="center" justify="space-between">
            <Text fontSize="11px" fontWeight="900" color={TEXT}>
              {confidence?.grade_ko ?? confidence?.grade ?? "분석 신뢰도"}
            </Text>
            <Text fontSize="17px" fontWeight="900" color={ORANGE}>{Math.round(confidenceScore)}%</Text>
          </Flex>
          <Progress
            mt="9px"
            value={confidenceScore}
            h="6px"
            borderRadius="full"
            bg="#F0EBE5"
            sx={{ "& > div": { background: ORANGE, borderRadius: "999px" } }}
          />
          <Text mt="12px" fontSize="10px" lineHeight="1.65" color="#675D54">
            {confidence?.explanation ?? "현재 입력 정보와 시장 데이터를 기준으로 산출한 분석 신뢰도입니다."}
          </Text>
        </SectionCard>

        <SectionCard title="주요 불확실성 요소">
          <Stack spacing="8px">
            {(result.uncertainty_factors ?? []).length > 0 ? (
              result.uncertainty_factors?.map((item, index) => (
                <Flex key={`${item}-${index}`} gap="8px" align="flex-start">
                  <Box mt="5px" w="5px" h="5px" borderRadius="full" bg={ORANGE} flexShrink={0} />
                  <Text fontSize="10px" lineHeight="1.65" color="#675D54">{item}</Text>
                </Flex>
              ))
            ) : (
              <Text fontSize="10px" color={MUTED}>뚜렷한 불확실성 요소가 감지되지 않았습니다.</Text>
            )}
          </Stack>
        </SectionCard>
      </Grid>

      <SectionCard title="시장 참여자 반응" subtitle="참여자 유형별 예상 반응">
        {agents.length > 0 ? (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="10px">
            {agents.map((agent, index) => (
              <Box key={agent.agent_type ?? String(index)} p="12px" bg="#FFFCF8" borderWidth="1px" borderColor="#F0E7DE" borderRadius="10px">
                <Flex align="center">
                  <Text fontSize="11px" fontWeight="900" color={TEXT}>
                    {agent.agent_name_ko ?? agent.agent_type ?? "시장 참여자"}
                  </Text>
                  <Box flex="1" />
                  <Badge bg="#F6EFE8" color={toneColor(agent.reaction_direction)} fontSize="8px">
                    {agent.reaction_direction_ko ?? directionKoMap[agent.reaction_direction ?? ""] ?? "중립"}
                  </Badge>
                </Flex>
                <Text mt="9px" fontSize="10px" lineHeight="1.6" color="#675D54">
                  {agent.comment ?? agent.key_reasons?.[0] ?? "세부 반응 설명이 없습니다."}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        ) : (
          <Text fontSize="10px" color={MUTED}>시장 참여자 반응 데이터가 없습니다.</Text>
        )}
      </SectionCard>

      <SectionCard title="종합 해설">
        <Text fontSize="11px" lineHeight="1.8" color="#5D544C" whiteSpace="pre-wrap">
          {result.overall_explanation ?? "종합 해설이 제공되지 않았습니다."}
        </Text>
      </SectionCard>
    </Stack>
  );
}

export default function MarketSimulatorPanel({
  stock,
  displayMode = "floating",
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  showTrigger = true,
}: Props) {
  const disclosure = useDisclosure();
  const toast = useToast();
  const isOpen = controlledIsOpen ?? disclosure.isOpen;
  const closeModal = controlledOnClose ?? disclosure.onClose;

  const [inputText, setInputText] = useState("");
  const [inputTypeHint, setInputTypeHint] = useState<InputTypeHint>("real_news");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intermediate, setIntermediate] = useState<IntermediateAnalysis>(emptyIntermediate);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);

  const effectiveStock = {
    code: stock?.symbol || "005930",
    name: stock?.name || "삼성전자",
  };

  const abortRequest = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  const resetAnalysis = useCallback(() => {
    abortRequest();
    setIsLoading(false);
    setResult(null);
    setError(null);
    setIntermediate(emptyIntermediate);
    setElapsedSeconds(0);
  }, [abortRequest]);

  const handleClose = () => {
    abortRequest();
    setIsLoading(false);
    closeModal();
  };

  useEffect(() => {
    resetAnalysis();
    return abortRequest;
  }, [effectiveStock.code, resetAnalysis, abortRequest]);

  useEffect(() => {
    if (displayMode === "floating" && !isOpen) {
      abortRequest();
      setIsLoading(false);
    }
  }, [displayMode, isOpen, abortRequest]);

  useEffect(() => {
    if (!isLoading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const runSimulation = async () => {
    if (!inputText.trim()) {
      toast({ title: "분석할 내용을 입력하세요.", status: "warning", duration: 2200, isClosable: true });
      return;
    }

    abortRequest();
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setIntermediate(emptyIntermediate);
    setElapsedSeconds(0);

    try {
      await streamMarketSimulation({
        url: api.getUri({ url: "/market-reaction/simulate/stream" }),
        request: {
          user_id: "test_user_001",
          selected_stock: effectiveStock,
          input_text: inputText.trim(),
          input_type_hint: inputTypeHint,
        },
        token: tokens.getToken(),
        withCredentials: api.defaults.withCredentials,
        signal: controller.signal,
        onEvent: (event) => {
          if (activeRequest.current !== controller || controller.signal.aborted) return;
          switch (event.event) {
            case "progress":
              setIntermediate((previous) => ({ ...previous, progress: event.data }));
              break;
            case "context":
              setIntermediate((previous) => ({ ...previous, context: event.data }));
              break;
            case "agent":
              setIntermediate((previous) => ({
                ...previous,
                agents: [...previous.agents.filter((item) => item.agent.agent_type !== event.data.agent.agent_type), event.data],
              }));
              break;
            case "aggregate":
              setIntermediate((previous) => ({ ...previous, aggregate: event.data }));
              break;
            case "result":
              setResult(event.data);
              break;
            case "error":
              setError(event.data.message || "시뮬레이션 실행 중 오류가 발생했습니다.");
              break;
          }
        },
      });
    } catch (requestError: unknown) {
      if (activeRequest.current === controller && !controller.signal.aborted) {
        setError(requestError instanceof Error ? requestError.message : "시뮬레이션 실행 중 오류가 발생했습니다.");
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsLoading(false);
      }
    }
  };

  const inputView = (
    <Stack spacing="18px">
      <Box>
        <Text fontSize="12px" fontWeight="900" color={TEXT}>뉴스 / 이벤트 내용</Text>
        <Text mt="4px" fontSize="10px" color={MUTED}>
          현재 선택 종목: <strong>{effectiveStock.name} ({effectiveStock.code})</strong>
        </Text>
      </Box>

      <Box position="relative">
        <Textarea
          value={inputText}
          onChange={(event) => setInputText(event.target.value.slice(0, 500))}
          maxLength={500}
          minH="168px"
          resize="none"
          borderColor="#E2D4C5"
          borderRadius="10px"
          bg="white"
          fontSize="12px"
          lineHeight="1.7"
          placeholder="예: AI 반도체 수요 증가로 삼성전자의 HBM 관련 실적 개선 가능성이 높아질 것으로 예상된다."
          _focusVisible={{ borderColor: ORANGE, boxShadow: "0 0 0 1px #F36F2A" }}
        />
        <Text position="absolute" right="11px" bottom="9px" fontSize="9px" color={MUTED}>{inputText.length}/500</Text>
      </Box>

      <Box>
        <Text mb="9px" fontSize="10px" fontWeight="900" color={TEXT}>입력 유형</Text>
        <Wrap spacing="7px">
          {inputTypeOptions.map((option) => {
            const selected = inputTypeHint === option.value;
            return (
              <WrapItem key={option.value}>
                <Button
                  size="sm"
                  h="32px"
                  px="12px"
                  borderRadius="full"
                  variant="outline"
                  borderColor={selected ? ORANGE : BORDER}
                  bg={selected ? ORANGE_SOFT : "white"}
                  color={selected ? ORANGE_DARK : "#6F655C"}
                  fontSize="10px"
                  fontWeight="800"
                  onClick={() => setInputTypeHint(option.value)}
                >
                  {option.label}
                </Button>
              </WrapItem>
            );
          })}
        </Wrap>
      </Box>

      <Box p="13px" borderRadius="10px" bg="#FBF7F2" borderWidth="1px" borderColor="#EFE4D8">
        <Text fontSize="10px" fontWeight="900" color={TEXT}>예시 입력</Text>
        <Stack mt="8px" spacing="5px">
          {sampleInputs.map((sample) => (
            <Button
              key={sample}
              h="auto"
              py="5px"
              px="0"
              variant="ghost"
              justifyContent="flex-start"
              whiteSpace="normal"
              textAlign="left"
              fontSize="10px"
              fontWeight="600"
              color="#746A61"
              _hover={{ color: ORANGE_DARK, bg: "transparent" }}
              onClick={() => setInputText(sample)}
            >
              • {sample}
            </Button>
          ))}
        </Stack>
      </Box>

      <Box p="11px 12px" bg="#FFF7ED" borderRadius="9px" borderWidth="1px" borderColor="#F1DDC6">
        <Text fontSize="9px" lineHeight="1.6" color="#7B6757">
          이 기능은 입력한 사건에 대한 시장 반응 성향을 학습 목적으로 분석하며, 특정 종목의 매수·매도를 권유하지 않습니다.
        </Text>
      </Box>

      {error && (
        <Box p="12px" bg="#FFF1EF" borderWidth="1px" borderColor="#F2CEC9" borderRadius="9px">
          <Text fontSize="10px" color="#C94D40" lineHeight="1.6">{error}</Text>
        </Box>
      )}

      <Flex justify="flex-end" gap="8px">
        <Button size="sm" minW="92px" variant="outline" borderColor={BORDER} color="#71665C" onClick={handleClose}>취소</Button>
        <Button
          size="sm"
          minW="132px"
          bg={ORANGE}
          color="white"
          _hover={{ bg: ORANGE_DARK }}
          onClick={runSimulation}
          isLoading={isLoading}
          loadingText="분석 중"
        >
          AI 분석 시작
        </Button>
      </Flex>
    </Stack>
  );

  const content = isLoading ? (
    <IntermediateView analysis={intermediate} elapsedSeconds={elapsedSeconds} onCancel={resetAnalysis} />
  ) : result ? (
    <ResultView result={result} onReset={resetAnalysis} onClose={handleClose} />
  ) : (
    inputView
  );

  if (displayMode === "page") {
    return <Box maxW="1180px" mx="auto" p={{ base: "16px", md: "24px" }} bg={BACKGROUND}>{content}</Box>;
  }

  return (
    <>
      {showTrigger && (
        <Portal>
          <Button
            position="fixed"
            right={{ base: "20px", md: "32px" }}
            bottom={{ base: "72px", md: "88px" }}
            zIndex="popover"
            borderRadius="full"
            bg={ORANGE}
            color="white"
            boxShadow="0 10px 24px rgba(243,111,42,.24)"
            _hover={{ bg: ORANGE_DARK }}
            onClick={disclosure.onOpen}
          >
            시장 반응 시뮬레이터
          </Button>
        </Portal>
      )}

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size={result ? "6xl" : "2xl"}
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay bg="rgba(28,24,20,.52)" backdropFilter="blur(1px)" />
        <ModalContent
          maxW={result ? "1120px" : "720px"}
          maxH="90vh"
          borderRadius="14px"
          borderWidth="1px"
          borderColor={BORDER}
          overflow="hidden"
          bg={BACKGROUND}
          boxShadow="0 24px 70px rgba(35,28,22,.20)"
        >
          <Flex px={{ base: "18px", md: "24px" }} py="17px" align="center" bg="white" borderBottomWidth="1px" borderColor={BORDER}>
            <Box>
              <Heading size="md" letterSpacing="-0.04em" color={TEXT}>시장 반응 시뮬레이터</Heading>
              <Text mt="4px" fontSize="10px" color={MUTED}>입력한 뉴스/이벤트에 대한 시장 반응 성향을 분석합니다.</Text>
            </Box>
            <Box flex="1" />
            <CloseButton size="sm" onClick={handleClose} />
          </Flex>

          <ModalBody p={{ base: "18px", md: result ? "20px" : "24px" }} bg={BACKGROUND}>
            {content}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
