import { useEffect, useState } from "react";
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
  type AiProbabilities,
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

  // 기존 호출부 호환용
  chartPoints: ChartPointLike[];
  chartPeriod: string;
  chartInterval: string;
};

const ORANGE = "#F36F2A";
const ORANGE_SOFT = "#FFF4EC";
const BORDER = "#E8DCCE";
const TEXT = "#2B251F";
const MUTED = "#8C8177";

const EMPTY_PROBABILITIES: AiProbabilities = {
  매수: 0,
  관망: 0,
  매도: 0,
};

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

function factorAccent(direction?: "긍정" | "부정" | null) {
  if (direction === "긍정") return "#E85B47";
  if (direction === "부정") return "#3C70D8";
  return "#B1A79E";
}

function formatPercent(value?: number) {
  if (
    value === undefined ||
    value === null ||
    Number.isNaN(value)
  ) {
    return "0.0";
  }

  return value.toFixed(1);
}

function formatHistoryTime(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatComputedTime(iso?: string) {
  if (!iso) return "-";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 매수 / 관망 / 매도 확률
 */
function ProbabilityPanel({
  probabilities,
}: {
  probabilities: AiProbabilities;
}) {
  const decisions: AiDecision[] = [
    "매수",
    "관망",
    "매도",
  ];

  return (
    <SimpleGrid columns={3} spacing="8px">
      {decisions.map((decision) => {
        const value =
          probabilities?.[decision] ?? 0;

        const color =
          decisionColor(decision);

        return (
          <Box
            key={decision}
            minW="0"
            px="9px"
            py="10px"
            bg="rgba(255,255,255,.76)"
            borderRadius="9px"
            borderWidth="1px"
            borderColor="rgba(255,255,255,.9)"
          >
            <Flex align="center">
              <Text
                fontSize="9px"
                fontWeight="800"
                color={MUTED}
              >
                {decision}
              </Text>

              <Spacer />

              <Text
                fontSize="11px"
                fontWeight="900"
                color={color}
              >
                {formatPercent(value)}%
              </Text>
            </Flex>

            <Progress
              mt="7px"
              value={value}
              h="4px"
              bg="#ECE6DF"
              borderRadius="full"
              sx={{
                "& > div": {
                  background: color,
                  borderRadius: "999px",
                },
              }}
            />
          </Box>
        );
      })}
    </SimpleGrid>
  );
}

/**
 * 판단 요인
 */
function FactorCard({
  factor,
}: {
  factor: AiJudgmentFactor;
}) {
  const accent = factorAccent(
    factor.direction,
  );

  return (
    <Box
      p="12px"
      bg="white"
      borderWidth="1px"
      borderColor={BORDER}
      borderRadius="10px"
    >
      <Flex align="center" gap="8px">
        {factor.direction && (
          <Badge
            flexShrink={0}
            px="7px"
            py="2px"
            borderRadius="5px"
            fontSize="9px"
            bg={`${accent}18`}
            color={accent}
          >
            {factor.direction}
          </Badge>
        )}

        <Text
          flex="1"
          minW="0"
          fontSize="11px"
          fontWeight="800"
          color={TEXT}
          noOfLines={2}
        >
          {factor.factor}
        </Text>

        <Text
          flexShrink={0}
          fontSize="9px"
          fontWeight="800"
          color={MUTED}
        >
          강도{" "}
          {formatPercent(factor.weight)}
        </Text>
      </Flex>

      <Progress
        mt="9px"
        value={factor.weight}
        h="4px"
        borderRadius="full"
        bg="#F0EBE6"
        sx={{
          "& > div": {
            background: accent,
            borderRadius: "999px",
          },
        }}
      />
    </Box>
  );
}

/**
 * 히스토리 내부의 3방향 확률
 */
function HistoryProbabilities({
  probabilities,
}: {
  probabilities: AiProbabilities;
}) {
  return (
    <Flex
      mt="7px"
      gap="9px"
      wrap="wrap"
    >
      {(
        [
          "매수",
          "관망",
          "매도",
        ] as AiDecision[]
      ).map((decision) => (
        <Text
          key={decision}
          fontSize="8px"
          fontWeight="800"
          color={decisionColor(decision)}
        >
          {decision}{" "}
          {formatPercent(
            probabilities?.[decision] ?? 0,
          )}
          %
        </Text>
      ))}
    </Flex>
  );
}

export default function AiRamenPanel({
  isOpen,
  onClose,
  stock,
}: Props) {
  /**
   * 최초 진입은 비교 화면.
   */
  const [tab, setTab] = useState<
    "비교" | "판단근거" | "히스토리"
  >("비교");

  const [judgment, setJudgment] =
    useState<AiJudgment | null>(null);

  const [history, setHistory] =
    useState<AiHistoryEntry[]>([]);

  const [
    isLoadingJudgment,
    setIsLoadingJudgment,
  ] = useState(false);

  const [
    isLoadingHistory,
    setIsLoadingHistory,
  ] = useState(false);

  /**
   * 사용자의 최초 판단
   */
  const [
    userDecision,
    setUserDecision,
  ] = useState<AiDecision | null>(null);

  /**
   * 사용자가 판단을 제출했는지 여부.
   *
   * false:
   * AI 판단 완전히 숨김
   *
   * true:
   * AI 판단 공개
   */
  const [
    hasSubmittedDecision,
    setHasSubmittedDecision,
  ] = useState(false);

  const [
    compareResult,
    setCompareResult,
  ] =
    useState<AiCompareResult | null>(
      null,
    );

  const [
    isComparing,
    setIsComparing,
  ] = useState(false);

  /**
   * =====================================
   * AI 감시 + 데이터 갱신
   * =====================================
   *
   * 중요한 점:
   *
   * AI 판단 데이터 자체는 백그라운드에서
   * 미리 받아두지만,
   *
   * hasSubmittedDecision === false
   *
   * 동안 화면에는 절대 보여주지 않는다.
   */
  useEffect(() => {
    if (!isOpen || !stock?.symbol) {
      setJudgment(null);
      setHistory([]);
      setUserDecision(null);
      setCompareResult(null);
      setHasSubmittedDecision(false);
      setTab("비교");

      return;
    }

    const symbol = stock.symbol;

    let cancelled = false;

    /**
     * 종목이 바뀔 때는 완전히 초기화.
     *
     * 삼성전자에서 매수를 골랐더라도
     * SK하이닉스로 이동하면 다시 질문한다.
     */
    setJudgment(null);
    setHistory([]);
    setUserDecision(null);
    setCompareResult(null);
    setHasSubmittedDecision(false);
    setTab("비교");

    const refresh = async (
      showLoading: boolean,
    ) => {
      if (showLoading) {
        setIsLoadingJudgment(true);
        setIsLoadingHistory(true);
      }

      try {
        /**
         * 감시 등록.
         *
         * 최초 종목이라면 백엔드에서
         * cold start까지 처리한다.
         */
        await judgmentService
          .watchSymbol(symbol)
          .catch(() => {});

        /**
         * AI 결과는 미리 가져온다.
         *
         * 단, 사용자 선택 전까지
         * 화면에는 표시하지 않는다.
         */
        const [
          nextJudgment,
          nextHistory,
        ] = await Promise.all([
          judgmentService
            .getJudgment(symbol)
            .catch(() => null),

          judgmentService
            .getHistory(symbol)
            .catch(() => []),
        ]);

        if (cancelled) return;

        setJudgment(nextJudgment);
        setHistory(nextHistory);
      } finally {
        if (
          !cancelled &&
          showLoading
        ) {
          setIsLoadingJudgment(false);
          setIsLoadingHistory(false);
        }
      }
    };

    void refresh(true);

    /**
     * 30초마다:
     *
     * watch heartbeat
     * +
     * 최신 판단
     * +
     * 최신 history
     *
     * 조회
     */
    const heartbeat =
      window.setInterval(() => {
        void refresh(false);
      }, 30_000);

    return () => {
      cancelled = true;

      window.clearInterval(heartbeat);

      void judgmentService
        .unwatchSymbol(symbol)
        .catch(() => {});
    };
  }, [isOpen, stock?.symbol]);

  /**
   * =====================================
   * 사용자가 판단 선택
   * =====================================
   */
  const handleSelectDecision = async (
    decision: AiDecision,
  ) => {
    if (!stock?.symbol) return;

    setUserDecision(decision);

    setCompareResult(null);

    setIsComparing(true);

    try {
      /**
       * 사용자의 판단을 AI 현재 판단과 비교.
       */
      const result =
        await judgmentService.compare(
          stock.symbol,
          decision,
        );

      setCompareResult(result);

      /**
       * 비교가 정상적으로 끝난 시점부터
       * AI 판단 공개.
       */
      setHasSubmittedDecision(true);

      setTab("비교");
    } catch (error) {
      console.error(
        "AI 판단 비교 실패:",
        error,
      );

      setCompareResult(null);

      setHasSubmittedDecision(false);
    } finally {
      setIsComparing(false);
    }
  };

  /**
   * 다시 선택
   */
  const handleRetryDecision = () => {
    setHasSubmittedDecision(false);

    setUserDecision(null);

    setCompareResult(null);

    setTab("비교");
  };

  if (!isOpen) {
    return null;
  }

  /**
   * =====================================
   * AI 현재 값
   * =====================================
   */

  const aiDecision: AiDecision =
    judgment?.judge ?? "관망";

  const probabilities =
    judgment?.probabilities ??
    EMPTY_PROBABILITIES;

  const factors =
    judgment?.factors ?? [];

  const positiveFactors =
    factors.filter(
      (factor) =>
        factor.direction === "긍정",
    );

  const negativeFactors =
    factors.filter(
      (factor) =>
        factor.direction === "부정",
    );

  const neutralFactors =
    factors.filter(
      (factor) => !factor.direction,
    );

  const summary =
    isLoadingJudgment
      ? "AI가 현재 시장 데이터를 분석하고 있습니다."
      : judgment?.summary ??
        (stock
          ? "아직 계산된 AI 판단이 없습니다."
          : "종목을 선택하면 AI 판단을 확인할 수 있습니다.");

  /**
   * compare API 기준 AI 판단.
   *
   * 사용자가 버튼을 누른 정확한 시점의
   * AI 판단이므로 비교 화면에서는
   * 이 값을 우선 사용한다.
   */
  const comparedAiDecision:
    AiDecision =
    compareResult?.ai_judge ??
    aiDecision;

  const comparedProbabilities =
    compareResult?.ai_probabilities ??
    probabilities;

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
      {/* =================================
          HEADER
      ================================= */}

      <Box
        px="16px"
        pt="16px"
        pb="14px"
        bg="white"
        borderBottomWidth="1px"
        borderColor={BORDER}
      >
        <Flex align="center">
          <Box minW="0">
            <Text
              fontSize="15px"
              fontWeight="900"
              color={TEXT}
              letterSpacing="-0.03em"
            >
              AI라면?
            </Text>

            <Text
              mt="2px"
              fontSize="9px"
              color={MUTED}
              noOfLines={1}
            >
              {stock
                ? `${stock.name} · ${stock.symbol}`
                : "선택 종목 없음"}
            </Text>
          </Box>

          <Spacer />

          <Button
            size="xs"
            variant="ghost"
            color={ORANGE}
            fontSize="18px"
            onClick={onClose}
          >
            ←
          </Button>
        </Flex>

        {/* =================================
            사용자 판단 전
        ================================= */}

        {!hasSubmittedDecision && (
          <Box
            mt="16px"
            p="16px"
            bg="#FFF8F2"
            borderWidth="1px"
            borderColor="#F4DED0"
            borderRadius="12px"
          >
            <Text
              fontSize="13px"
              fontWeight="900"
              color={TEXT}
              letterSpacing="-0.02em"
            >
              당신이라면 어떻게
              판단하시겠어요?
            </Text>

            <Text
              mt="6px"
              fontSize="9px"
              lineHeight="1.7"
              color={MUTED}
            >
              AI의 판단을 확인하기 전에
              현재 시장 상황에 대한 본인의
              판단을 먼저 선택해보세요.
            </Text>

            <SimpleGrid
              mt="15px"
              columns={3}
              spacing="8px"
            >
              {(
                [
                  "매수",
                  "관망",
                  "매도",
                ] as AiDecision[]
              ).map((decision) => (
                <Button
                  key={decision}
                  h="42px"
                  borderRadius="9px"
                  variant="outline"
                  borderColor={
                    userDecision ===
                    decision
                      ? decisionColor(
                          decision,
                        )
                      : BORDER
                  }
                  bg={
                    userDecision ===
                    decision
                      ? decisionBg(
                          decision,
                        )
                      : "white"
                  }
                  color={decisionColor(
                    decision,
                  )}
                  fontSize="11px"
                  fontWeight="900"
                  isLoading={
                    isComparing &&
                    userDecision ===
                      decision
                  }
                  isDisabled={
                    isComparing ||
                    !stock
                  }
                  onClick={() =>
                    handleSelectDecision(
                      decision,
                    )
                  }
                >
                  {decision}
                </Button>
              ))}
            </SimpleGrid>

            {isLoadingJudgment ? (
              <Text
                mt="12px"
                textAlign="center"
                fontSize="8px"
                color="#AAA097"
              >
                AI가 시장 데이터를
                분석하고 있습니다.
              </Text>
            ) : (
              <Text
                mt="12px"
                textAlign="center"
                fontSize="8px"
                color="#AAA097"
              >
                선택하기 전에는 AI의
                판단을 공개하지 않습니다.
              </Text>
            )}
          </Box>
        )}

        {/* =================================
            사용자 판단 후
            내 판단 VS AI
        ================================= */}

        {hasSubmittedDecision &&
          compareResult && (
            <>
              <Grid
                mt="15px"
                templateColumns="1fr 36px 1fr"
                gap="7px"
                alignItems="stretch"
              >
                {/* 내 판단 */}

                <Box
                  p="13px"
                  bg={
                    userDecision
                      ? decisionBg(
                          userDecision,
                        )
                      : "white"
                  }
                  borderWidth="1px"
                  borderColor={
                    userDecision
                      ? `${decisionColor(
                          userDecision,
                        )}30`
                      : BORDER
                  }
                  borderRadius="10px"
                  textAlign="center"
                >
                  <Text
                    fontSize="8px"
                    color={MUTED}
                  >
                    나의 판단
                  </Text>

                  <Text
                    mt="5px"
                    fontSize="20px"
                    fontWeight="900"
                    color={
                      userDecision
                        ? decisionColor(
                            userDecision,
                          )
                        : MUTED
                    }
                  >
                    {userDecision ?? "-"}
                  </Text>
                </Box>

                <Flex
                  align="center"
                  justify="center"
                >
                  <Text
                    fontSize="9px"
                    fontWeight="900"
                    color="#B4AAA1"
                  >
                    VS
                  </Text>
                </Flex>

                {/* AI 판단 */}

                <Box
                  p="13px"
                  bg={decisionBg(
                    comparedAiDecision,
                  )}
                  borderWidth="1px"
                  borderColor={`${decisionColor(
                    comparedAiDecision,
                  )}30`}
                  borderRadius="10px"
                  textAlign="center"
                >
                  <Text
                    fontSize="8px"
                    color={MUTED}
                  >
                    AI 판단
                  </Text>

                  <Flex
                    mt="5px"
                    justify="center"
                    align="baseline"
                    gap="4px"
                  >
                    <Text
                      fontSize="20px"
                      fontWeight="900"
                      color={decisionColor(
                        comparedAiDecision,
                      )}
                    >
                      {
                        comparedAiDecision
                      }
                    </Text>

                    <Text
                      fontSize="10px"
                      fontWeight="900"
                      color={decisionColor(
                        comparedAiDecision,
                      )}
                    >
                      {formatPercent(
                        comparedProbabilities[
                          comparedAiDecision
                        ],
                      )}
                      %
                    </Text>
                  </Flex>
                </Box>
              </Grid>

              {/* 판단 일치 여부 */}

              <Box
                mt="10px"
                px="12px"
                py="10px"
                bg={
                  userDecision ===
                  comparedAiDecision
                    ? "#F2F9F2"
                    : "#FFF7ED"
                }
                borderRadius="9px"
              >
                <Text
                  fontSize="10px"
                  fontWeight="900"
                  color={TEXT}
                >
                  {userDecision ===
                  comparedAiDecision
                    ? "AI와 같은 방향으로 판단했습니다."
                    : "AI와 다른 방향으로 판단했습니다."}
                </Text>

                <Text
                  mt="3px"
                  fontSize="8px"
                  color={MUTED}
                >
                  최근 AI 분석{" "}
                  {formatComputedTime(
                    judgment?.computed_at,
                  )}
                </Text>
              </Box>
            </>
          )}
      </Box>

      {/* =================================
          판단 이후에만 탭 공개
      ================================= */}

      {hasSubmittedDecision && (
        <>
          <Grid
            templateColumns="repeat(3, 1fr)"
            bg="white"
            borderBottomWidth="1px"
            borderColor={BORDER}
          >
            {(
              [
                "비교",
                "판단근거",
                "히스토리",
              ] as const
            ).map((item) => (
              <Button
                key={item}
                h="42px"
                variant="ghost"
                borderRadius="0"
                fontSize="10px"
                fontWeight={
                  tab === item
                    ? "900"
                    : "700"
                }
                color={
                  tab === item
                    ? TEXT
                    : "#B1A79E"
                }
                borderBottomWidth="2px"
                borderBottomColor={
                  tab === item
                    ? ORANGE
                    : "transparent"
                }
                onClick={() =>
                  setTab(item)
                }
              >
                {item}
              </Button>
            ))}
          </Grid>

          <Box
            p="12px"
            maxH="650px"
            overflowY="auto"
          >
            {/* =============================
                비교
            ============================= */}

            {tab === "비교" &&
              compareResult && (
                <Stack spacing="12px">
                  <Box>
                    <Text
                      px="2px"
                      mb="7px"
                      fontSize="10px"
                      fontWeight="900"
                      color={TEXT}
                    >
                      AI와 내 판단 비교
                    </Text>

                    <Box
                      p="13px"
                      bg={
                        userDecision ===
                        comparedAiDecision
                          ? "#F2F9F2"
                          : "#FFF7ED"
                      }
                      borderRadius="10px"
                    >
                      <Text
                        fontSize="9px"
                        lineHeight="1.75"
                        color="#625950"
                      >
                        {
                          compareResult.explanation
                        }
                      </Text>
                    </Box>
                  </Box>

                  {/* AI 확률 분포 */}

                  <Box>
                    <Text
                      px="2px"
                      mb="7px"
                      fontSize="10px"
                      fontWeight="900"
                      color={TEXT}
                    >
                      AI 판단 분포
                    </Text>

                    <Box
                      p="10px"
                      bg="white"
                      borderWidth="1px"
                      borderColor={BORDER}
                      borderRadius="10px"
                    >
                      <ProbabilityPanel
                        probabilities={
                          comparedProbabilities
                        }
                      />
                    </Box>
                  </Box>

                  {/* 중요 요인 */}

                  {compareResult
                    .highlighted_factors
                    ?.length > 0 && (
                    <Box>
                      <Text
                        px="2px"
                        mb="7px"
                        fontSize="10px"
                        fontWeight="900"
                        color={TEXT}
                      >
                        AI가 중요하게 본 요인
                      </Text>

                      <Flex
                        gap="6px"
                        wrap="wrap"
                      >
                        {compareResult.highlighted_factors.map(
                          (
                            factor,
                            index,
                          ) => (
                            <Badge
                              key={`${factor}-${index}`}
                              px="8px"
                              py="5px"
                              bg="#F7F2EC"
                              color="#665B52"
                              borderRadius="7px"
                              fontSize="8px"
                              whiteSpace="normal"
                            >
                              {factor}
                            </Badge>
                          ),
                        )}
                      </Flex>
                    </Box>
                  )}

                  {/* 다시 선택 */}

                  <Button
                    mt="4px"
                    size="sm"
                    variant="outline"
                    borderColor={BORDER}
                    bg="white"
                    color={MUTED}
                    fontSize="9px"
                    onClick={
                      handleRetryDecision
                    }
                  >
                    내 판단 다시 선택하기
                  </Button>
                </Stack>
              )}

            {/* =============================
                판단 근거
            ============================= */}

            {tab === "판단근거" && (
              <Stack spacing="11px">
                <Box>
                  <Text
                    px="2px"
                    mb="6px"
                    fontSize="10px"
                    fontWeight="900"
                    color={TEXT}
                  >
                    AI 판단 요약
                  </Text>

                  <Box
                    p="12px"
                    bg="#F8F5F1"
                    borderRadius="9px"
                  >
                    <Text
                      fontSize="10px"
                      lineHeight="1.75"
                      color="#625950"
                    >
                      {summary}
                    </Text>
                  </Box>
                </Box>

                {/* 긍정 */}

                {positiveFactors.length >
                  0 && (
                  <Box>
                    <Flex
                      align="center"
                      mb="7px"
                      px="2px"
                    >
                      <Text
                        fontSize="10px"
                        fontWeight="900"
                        color={TEXT}
                      >
                        긍정 신호
                      </Text>

                      <Spacer />

                      <Text
                        fontSize="8px"
                        color={MUTED}
                      >
                        {
                          positiveFactors.length
                        }
                        개
                      </Text>
                    </Flex>

                    <Stack spacing="7px">
                      {positiveFactors.map(
                        (
                          factor,
                          index,
                        ) => (
                          <FactorCard
                            key={`${factor.factor}-${index}`}
                            factor={
                              factor
                            }
                          />
                        ),
                      )}
                    </Stack>
                  </Box>
                )}

                {/* 부정 */}

                {negativeFactors.length >
                  0 && (
                  <Box>
                    <Flex
                      align="center"
                      mb="7px"
                      px="2px"
                    >
                      <Text
                        fontSize="10px"
                        fontWeight="900"
                        color={TEXT}
                      >
                        부정 신호
                      </Text>

                      <Spacer />

                      <Text
                        fontSize="8px"
                        color={MUTED}
                      >
                        {
                          negativeFactors.length
                        }
                        개
                      </Text>
                    </Flex>

                    <Stack spacing="7px">
                      {negativeFactors.map(
                        (
                          factor,
                          index,
                        ) => (
                          <FactorCard
                            key={`${factor.factor}-${index}`}
                            factor={
                              factor
                            }
                          />
                        ),
                      )}
                    </Stack>
                  </Box>
                )}

                {/* 방향 없는 예전 데이터 */}

                {neutralFactors.length >
                  0 && (
                  <Box>
                    <Flex
                      align="center"
                      mb="7px"
                      px="2px"
                    >
                      <Text
                        fontSize="10px"
                        fontWeight="900"
                        color={TEXT}
                      >
                        기타 신호
                      </Text>

                      <Spacer />

                      <Text
                        fontSize="8px"
                        color={MUTED}
                      >
                        {
                          neutralFactors.length
                        }
                        개
                      </Text>
                    </Flex>

                    <Stack spacing="7px">
                      {neutralFactors.map(
                        (
                          factor,
                          index,
                        ) => (
                          <FactorCard
                            key={`${factor.factor}-${index}`}
                            factor={
                              factor
                            }
                          />
                        ),
                      )}
                    </Stack>
                  </Box>
                )}

                {!isLoadingJudgment &&
                  factors.length === 0 && (
                    <Box
                      py="18px"
                      textAlign="center"
                    >
                      <Text
                        fontSize="10px"
                        color={MUTED}
                      >
                        현재 감지된 주요 시장
                        신호가 없습니다.
                      </Text>
                    </Box>
                  )}
              </Stack>
            )}

            {/* =============================
                히스토리
            ============================= */}

            {tab === "히스토리" && (
              <Stack spacing="0">
                <Box
                  mb="14px"
                  p="11px"
                  bg={ORANGE_SOFT}
                  borderRadius="9px"
                >
                  <Text
                    fontSize="10px"
                    fontWeight="800"
                    color="#7A4E31"
                  >
                    AI의 판단과 확률이
                    시간에 따라 어떻게
                    변했는지 확인할 수
                    있습니다.
                  </Text>
                </Box>

                {isLoadingHistory ? (
                  <Text
                    py="24px"
                    fontSize="10px"
                    color={MUTED}
                    textAlign="center"
                  >
                    판단 이력을 불러오는
                    중...
                  </Text>
                ) : history.length ===
                  0 ? (
                  <Text
                    py="24px"
                    fontSize="10px"
                    color={MUTED}
                    textAlign="center"
                  >
                    아직 판단 이력이
                    없습니다.
                  </Text>
                ) : (
                  history.map(
                    (item, index) => (
                      <Flex
                        key={`${item.time}-${index}`}
                        gap="11px"
                        minH="90px"
                      >
                        {/* 타임라인 */}

                        <Flex
                          direction="column"
                          align="center"
                        >
                          <Box
                            mt="5px"
                            w="9px"
                            h="9px"
                            flexShrink={0}
                            borderRadius="full"
                            bg={decisionColor(
                              item.judge,
                            )}
                            boxShadow={
                              item.changed
                                ? `0 0 0 4px ${decisionColor(
                                    item.judge,
                                  )}18`
                                : undefined
                            }
                          />

                          {index <
                            history.length -
                              1 && (
                            <Box
                              mt="6px"
                              w="1px"
                              flex="1"
                              bg="#E8DED3"
                            />
                          )}
                        </Flex>

                        {/* 내용 */}

                        <Box
                          flex="1"
                          minW="0"
                          pb="16px"
                        >
                          <Flex align="center">
                            <Text
                              fontSize="9px"
                              color={MUTED}
                            >
                              {formatHistoryTime(
                                item.time,
                              )}
                            </Text>

                            <Spacer />

                            {item.changed && (
                              <Badge
                                mr="5px"
                                px="6px"
                                py="2px"
                                bg="#FFF0E7"
                                color={ORANGE}
                                fontSize="7px"
                                borderRadius="5px"
                              >
                                판단 변화
                              </Badge>
                            )}

                            <Badge
                              px="6px"
                              py="2px"
                              bg={decisionBg(
                                item.judge,
                              )}
                              color={decisionColor(
                                item.judge,
                              )}
                              fontSize="8px"
                              borderRadius="5px"
                            >
                              {item.judge}
                            </Badge>
                          </Flex>

                          <HistoryProbabilities
                            probabilities={
                              item.probabilities ??
                              EMPTY_PROBABILITIES
                            }
                          />

                          <Text
                            mt="7px"
                            fontSize="9px"
                            lineHeight="1.65"
                            color="#625950"
                          >
                            {item.reason}
                          </Text>
                        </Box>
                      </Flex>
                    ),
                  )
                )}
              </Stack>
            )}
          </Box>
        </>
      )}

      {/* =================================
          최초 선택 전에는 하단 설명
      ================================= */}

      {!hasSubmittedDecision && (
        <Box
          px="16px"
          py="12px"
          bg="#FFFCF8"
        >
          <Text
            fontSize="8px"
            lineHeight="1.6"
            textAlign="center"
            color="#A79C93"
          >
            먼저 스스로 판단한 뒤 AI와
            비교함으로써 투자 판단 과정의
            차이를 확인할 수 있습니다.
          </Text>
        </Box>
      )}
    </Box>
  );
}