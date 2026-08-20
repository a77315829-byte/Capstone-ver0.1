import {
  Box,
  Button,
  Flex,
  Grid,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";

/* =========================================================
   TYPES
========================================================= */

type BehaviorPattern = {
  pattern_code?: string;
  label?: string;
  classification?: string;
  occurrence_count?: number;
  evidence_turns?: number[];
  confidence?: number;
  explanation?: string;
  recommendation?: string;
};

type FinalEvaluation = {
  evaluation_id?: string;

  user_id?: string;

  session_id?: string;

  scenario_id?: string;

  scenario_version?: number;

  completed_at?: string;

  decision_evaluation?: {
    overall_score?: number;

    metric_averages?: Record<
      string,
      number
    >;

    timeline?: Array<{
      turn_no?: number;

      turn_score?: number;

      metrics?: Record<
        string,
        number
      >;
    }>;
  };

  behavior_patterns?: BehaviorPattern[];

  portfolio_analysis?: {
    initial_value?: number;

    final_value?: number;

    profit_loss?: number;

    cumulative_return_pct?: number;

    benchmark_asset_id?:
      | string
      | null;

    benchmark_return_pct?:
      | number
      | null;

    excess_return_pct?:
      | number
      | null;

    max_drawdown_pct?: number;

    turnover_pct?: number;

    average_cash_weight_pct?: number;

    maximum_asset_weight_pct?: number;

    concentration_hhi?: number;

    valuation_point_count?: number;

    sector_exposure?: Array<{
      sector?: string;

      market_value?: number;

      weight_pct?: number;
    }>;

    asset_contributions?: Array<{
      asset_id?: string;

      name?: string;

      total_pnl?: number;

      weight_pct?: number;
    }>;
  };

  feedback?: {
    summary?: string;

    strengths?: string[];

    improvements?: string[];

    next_actions?: string[];
  };
};

type Props = {
  isOpen: boolean;

  onClose: () => void;

  evaluation:
    | FinalEvaluation
    | null;

  onGoMyPage: () => void;
};

/* =========================================================
   DESIGN
========================================================= */

const ORANGE = "#F36F2A";

const ORANGE_DARK = "#D95E20";

const TEXT = "#29231E";

const MUTED = "#8C8177";

const SUBTLE = "#665D55";

const BORDER = "#E8DCCE";

const RED = "#F43E49";

const BLUE = "#3A7BED";

/* =========================================================
   METRICS
========================================================= */

const METRIC_META: Record<
  string,
  {
    label: string;
    icon: string;
    color: string;
    soft: string;
  }
> = {
  M1: {
    label: "핵심 요인 식별",
    icon:
      "/icons/search-red.svg",
    color: "#FF3F4B",
    soft: "#FFF1F2",
  },

  M2: {
    label: "정보 해석",
    icon:
      "/icons/book-yellow.svg",
    color: "#F5B800",
    soft: "#FFF9E6",
  },

  M3: {
    label: "위험 인식",
    icon:
      "/icons/shield-alert.svg",
    color: "#34BC64",
    soft: "#EEFAF2",
  },

  M4: {
    label: "행동 근거 합리성",
    icon:
      "/icons/ai-network.svg",
    color: "#2586E8",
    soft: "#EEF7FF",
  },

  M5: {
    label: "논리 일관성",
    icon:
      "/icons/user-signal.svg",
    color: "#BC3BD5",
    soft: "#FAEEFD",
  },
};

/* =========================================================
   HELPERS
========================================================= */

const krw =
  new Intl.NumberFormat(
    "ko-KR",
  );

function numberValue(
  value: unknown,
  fallback = 0,
) {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
}

function formatWon(
  value?:
    | number
    | null,
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(
      Number(value),
    )
  ) {
    return "-";
  }

  return `${krw.format(
    Math.round(
      Number(value),
    ),
  )}원`;
}

function formatSignedWon(
  value?:
    | number
    | null,
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(
      Number(value),
    )
  ) {
    return "-";
  }

  const numeric =
    Math.round(
      Number(value),
    );

  if (numeric > 0) {
    return `+${krw.format(
      numeric,
    )}원`;
  }

  return `${krw.format(
    numeric,
  )}원`;
}

function scoreStars(
  score: number,
) {
  return Math.max(
    0,
    Math.min(
      5,
      Math.round(score),
    ),
  );
}

/* =========================================================
   SCORE STARS
========================================================= */

function ScoreStars({
  score,
}: {
  score: number;
}) {
  const filled =
    scoreStars(score);

  return (
    <Flex
      mt="6px"
      justify="center"
      gap="2px"
    >
      {Array.from({
        length: 5,
      }).map(
        (_, index) => (
          <Text
            key={index}
            fontSize="11px"
            lineHeight="1"
            color={
              index < filled
                ? ORANGE
                : "#D8D1CA"
            }
          >
            ★
          </Text>
        ),
      )}
    </Flex>
  );
}

/* =========================================================
   METRIC ITEM
========================================================= */

function MetricItem({
  metricKey,
  score,
}: {
  metricKey: string;

  score: number;
}) {
  const meta =
    METRIC_META[
      metricKey
    ] ?? {
      label: metricKey,
      icon:
        "/icons/verified.svg",
      color: ORANGE,
      soft: "#FFF4EC",
    };

  return (
    <Box
      minW="0"
      textAlign="center"
    >
      <Text
        minH="25px"
        fontSize="8px"
        lineHeight="1.45"
        fontWeight="900"
        color={TEXT}
        noOfLines={2}
      >
        {meta.label}
      </Text>

      <Flex
        mt="7px"
        justify="center"
      >
        <Flex
          w="39px"
          h="39px"
          align="center"
          justify="center"
          bg={meta.soft}
          borderRadius="10px"
        >
          <Image
            src={meta.icon}
            alt={meta.label}
            w="27px"
            h="27px"
            objectFit="contain"
          />
        </Flex>
      </Flex>

      <Flex
        mt="7px"
        justify="center"
        align="baseline"
      >
        <Text
          fontSize="16px"
          lineHeight="1"
          fontWeight="900"
          color={TEXT}
        >
          {score.toFixed(1)}
        </Text>

        <Text
          ml="2px"
          fontSize="8px"
          color={MUTED}
        >
          / 5
        </Text>
      </Flex>

      <ScoreStars
        score={score}
      />
    </Box>
  );
}

/* =========================================================
   BULLET LIST
========================================================= */

function ResultList({
  items,
  emptyText,
  type,
}: {
  items: string[];

  emptyText: string;

  type:
    | "good"
    | "bad";
}) {
  if (
    items.length === 0
  ) {
    return (
      <Text
        fontSize="9px"
        lineHeight="1.65"
        color={MUTED}
      >
        {emptyText}
      </Text>
    );
  }

  return (
    <Stack spacing="9px">
      {items
        .slice(0, 4)
        .map(
          (
            item,
            index,
          ) => (
            <Flex
              key={`${item}-${index}`}
              gap="8px"
              align="flex-start"
            >
              <Flex
                mt="1px"
                w="16px"
                h="16px"
                align="center"
                justify="center"
                flexShrink={0}
                borderRadius="full"
                borderWidth="1px"
                borderColor={
                  type === "good"
                    ? ORANGE
                    : "#E79768"
                }
                color={
                  type === "good"
                    ? ORANGE
                    : "#D97A44"
                }
                fontSize="8px"
                fontWeight="900"
              >
                {type ===
                "good"
                  ? "✓"
                  : "!"}
              </Flex>

              <Text
                fontSize="9px"
                lineHeight="1.6"
                color={SUBTLE}
              >
                {item}
              </Text>
            </Flex>
          ),
        )}
    </Stack>
  );
}

/* =========================================================
   FINAL RESULT MODAL
========================================================= */

export default function FinalResultModal({
  isOpen,
  onClose,
  evaluation,
  onGoMyPage,
}: Props) {
  if (!evaluation) {
    return null;
  }

  const portfolio =
    evaluation
      .portfolio_analysis;

  const feedback =
    evaluation.feedback;

  const patterns =
    evaluation
      .behavior_patterns ??
    [];

  const metricValues =
    evaluation
      .decision_evaluation
      ?.metric_averages ??
    {};

  const metrics = [
    "M1",
    "M2",
    "M3",
    "M4",
    "M5",
  ].map((key) => ({
    key,

    score:
      numberValue(
        metricValues[key],
      ),
  }));

  const overallScore =
    numberValue(
      evaluation
        .decision_evaluation
        ?.overall_score,
    );

  const returnPct =
    numberValue(
      portfolio
        ?.cumulative_return_pct,
    );

  const profitLoss =
    numberValue(
      portfolio
        ?.profit_loss,
    );

  const strengths =
    feedback?.strengths
      ?.filter(Boolean)
      .length
      ? feedback.strengths.filter(
          Boolean,
        )
      : [
          "완료된 TURN의 판단 기록을 바탕으로 분석했습니다.",
        ];

  const improvements =
    feedback
      ?.improvements
      ?.filter(Boolean)
      .length
      ? feedback.improvements.filter(
          Boolean,
        )
      : patterns
          .map(
            (pattern) =>
              pattern.explanation ||
              pattern.label ||
              "",
          )
          .filter(Boolean);

  const nextActions =
    feedback?.next_actions
      ?.filter(Boolean)
      .length
      ? feedback.next_actions.filter(
          Boolean,
        )
      : patterns
          .map(
            (pattern) =>
              pattern.recommendation ??
              "",
          )
          .filter(Boolean);

  const positive =
    returnPct >= 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="4xl"
    >
      {/* =================================
          BACKGROUND
      ================================= */}

      <ModalOverlay
        bg="rgba(35, 31, 27, 0.48)"
        backdropFilter="blur(1px)"
      />

      {/* =================================
          CONTENT
      ================================= */}

      <ModalContent
        w={{
          base:
            "calc(100% - 24px)",

          md:
            "760px",
        }}
        maxW="760px"
        maxH="94vh"
        m="0"
        bg="#FFFDF9"
        borderRadius="14px"
        borderWidth="1px"
        borderColor={BORDER}
        boxShadow="0 22px 60px rgba(39, 30, 23, 0.22)"
        overflow="hidden"
      >
        <ModalCloseButton
          top="13px"
          right="13px"
          color="#8B8178"
          borderRadius="full"
          zIndex={2}
          _hover={{
            bg:
              "#F5EFE9",
          }}
        />

        <ModalBody
          px={{
            base: "18px",
            md: "24px",
          }}
          pt="24px"
          pb="11px"
          overflowY="auto"
          sx={{
            "&::-webkit-scrollbar":
              {
                width:
                  "6px",
              },

            "&::-webkit-scrollbar-thumb":
              {
                background:
                  "#D7CFC7",

                borderRadius:
                  "999px",
              },
          }}
        >
          {/* =================================
              TITLE
          ================================= */}

          <Flex
            direction="column"
            align="center"
          >
            <Image
              src="/icons/verified.svg"
              alt="시나리오 완료"
              w="38px"
              h="38px"
              objectFit="contain"
            />

            <Text
              mt="9px"
              fontSize={{
                base: "20px",
                md: "23px",
              }}
              fontWeight="900"
              letterSpacing="-0.045em"
              color={TEXT}
              textAlign="center"
            >
              시나리오가
              종료되었습니다!
            </Text>

            <Text
              mt="6px"
              fontSize="9px"
              lineHeight="1.65"
              textAlign="center"
              color={MUTED}
            >
              모든 TURN을
              완료했습니다.
              <br />
              당신의 투자 판단
              과정을 종합
              분석했습니다.
            </Text>
          </Flex>

          {/* =================================
              MAIN RESULTS
          ================================= */}

          <Grid
            mt="18px"
            templateColumns={{
              base: "1fr",

              md:
                "180px minmax(0, 1fr)",
            }}
            gap="9px"
          >
            {/* =============================
                PROFIT
            ============================= */}

            <Box
              p="14px"
              bg="white"
              borderWidth="1px"
              borderColor={BORDER}
              borderRadius="10px"
            >
              <Text
                fontSize="9px"
                fontWeight="900"
                color={TEXT}
              >
                판단 결과: 수익률
              </Text>

              <Text
                mt="15px"
                fontSize="27px"
                lineHeight="1"
                textAlign="center"
                fontWeight="900"
                color={
                  positive
                    ? RED
                    : BLUE
                }
              >
                {returnPct > 0
                  ? "+"
                  : ""}
                {returnPct.toFixed(
                  2,
                )}
                %
              </Text>

              <Text
                mt="5px"
                fontSize="9px"
                textAlign="center"
                fontWeight="800"
                color={
                  profitLoss >=
                  0
                    ? RED
                    : BLUE
                }
              >
                (
                {formatSignedWon(
                  profitLoss,
                )}
                )
              </Text>

              <Stack
                mt="17px"
                spacing="7px"
              >
                <Flex
                  justify="space-between"
                  gap="8px"
                >
                  <Text
                    fontSize="8px"
                    color={MUTED}
                  >
                    최종 자산
                  </Text>

                  <Text
                    fontSize="8px"
                    fontWeight="900"
                    color={TEXT}
                  >
                    {formatWon(
                      portfolio
                        ?.final_value,
                    )}
                  </Text>
                </Flex>

                <Flex
                  justify="space-between"
                  gap="8px"
                >
                  <Text
                    fontSize="8px"
                    color={MUTED}
                  >
                    초기 자산
                  </Text>

                  <Text
                    fontSize="8px"
                    fontWeight="800"
                    color={TEXT}
                  >
                    {formatWon(
                      portfolio
                        ?.initial_value,
                    )}
                  </Text>
                </Flex>

                <Box
                  borderTopWidth="1px"
                  borderColor="#EFE7DF"
                />

                <Flex
                  justify="space-between"
                  gap="8px"
                >
                  <Text
                    fontSize="8px"
                    color={MUTED}
                  >
                    판단 평균
                  </Text>

                  <Text
                    fontSize="8px"
                    fontWeight="900"
                    color={ORANGE}
                  >
                    {overallScore.toFixed(
                      2,
                    )}{" "}
                    / 5
                  </Text>
                </Flex>
              </Stack>
            </Box>

            {/* =============================
                5 METRICS
            ============================= */}

            <Box
              p="14px"
              bg="white"
              borderWidth="1px"
              borderColor={BORDER}
              borderRadius="10px"
            >
              <Flex
                align="center"
              >
                <Text
                  fontSize="10px"
                  fontWeight="900"
                  color={TEXT}
                >
                  5가지 항목별 점수
                </Text>

                <Text
                  ml="auto"
                  fontSize="7px"
                  color={MUTED}
                >
                  판단 과정 평가
                </Text>
              </Flex>

              <SimpleGrid
                mt="15px"
                columns={5}
                spacing="5px"
              >
                {metrics.map(
                  (metric) => (
                    <MetricItem
                      key={
                        metric.key
                      }
                      metricKey={
                        metric.key
                      }
                      score={
                        metric.score
                      }
                    />
                  ),
                )}
              </SimpleGrid>
            </Box>
          </Grid>

          {/* =================================
              GOOD / BAD
          ================================= */}

          <SimpleGrid
            mt="9px"
            columns={{
              base: 1,
              md: 2,
            }}
            spacing="9px"
          >
            {/* GOOD */}

            <Box
              p="14px"
              minH="145px"
              bg="white"
              borderWidth="1px"
              borderColor={BORDER}
              borderRadius="10px"
            >
              <Text
                fontSize="10px"
                fontWeight="900"
                color={TEXT}
              >
                잘 본 요소
              </Text>

              <Box mt="11px">
                <ResultList
                  type="good"
                  items={
                    strengths
                  }
                  emptyText="별도로 강조된 강점이 없습니다."
                />
              </Box>
            </Box>

            {/* BAD */}

            <Box
              p="14px"
              minH="145px"
              bg="white"
              borderWidth="1px"
              borderColor={BORDER}
              borderRadius="10px"
            >
              <Text
                fontSize="10px"
                fontWeight="900"
                color={TEXT}
              >
                놓친 요소
              </Text>

              <Box mt="11px">
                <ResultList
                  type="bad"
                  items={
                    improvements
                  }
                  emptyText="뚜렷하게 반복된 취약 패턴이 확인되지 않았습니다."
                />
              </Box>
            </Box>
          </SimpleGrid>

          {/* =================================
              CUSTOM FEEDBACK
          ================================= */}

          <Box
            mt="9px"
            p="14px"
            bg="white"
            borderWidth="1px"
            borderColor={BORDER}
            borderRadius="10px"
          >
            <Flex
              align="center"
              gap="7px"
            >
              <Flex
                w="24px"
                h="24px"
                align="center"
                justify="center"
                bg="#FFF4EC"
                borderRadius="6px"
              >
                <Image
                  src="/icons/document-orange.svg"
                  alt=""
                  w="14px"
                  h="14px"
                />
              </Flex>

              <Text
                fontSize="10px"
                fontWeight="900"
                color={TEXT}
              >
                해설: 맞춤 피드백
              </Text>
            </Flex>

            <Text
              mt="9px"
              fontSize="9px"
              lineHeight="1.75"
              color={SUBTLE}
            >
              {feedback?.summary ||
                "각 TURN에서 기록한 판단 근거와 행동 패턴, 포트폴리오 결과를 종합하여 분석했습니다."}
            </Text>

            {nextActions.length >
              0 && (
              <Box
                mt="11px"
                pt="10px"
                borderTopWidth="1px"
                borderColor="#EEE7E0"
              >
                <Text
                  fontSize="9px"
                  fontWeight="900"
                  color={TEXT}
                >
                  다음 투자에서
                  적용할 점
                </Text>

                <Stack
                  mt="7px"
                  spacing="6px"
                >
                  {nextActions
                    .slice(
                      0,
                      3,
                    )
                    .map(
                      (
                        action,
                        index,
                      ) => (
                        <Flex
                          key={`${action}-${index}`}
                          gap="7px"
                          align="flex-start"
                        >
                          <Flex
                            w="16px"
                            h="16px"
                            flexShrink={
                              0
                            }
                            align="center"
                            justify="center"
                            bg={
                              ORANGE
                            }
                            color="white"
                            borderRadius="full"
                            fontSize="7px"
                            fontWeight="900"
                          >
                            {index +
                              1}
                          </Flex>

                          <Text
                            fontSize="8px"
                            lineHeight="1.6"
                            color={
                              SUBTLE
                            }
                          >
                            {
                              action
                            }
                          </Text>
                        </Flex>
                      ),
                    )}
                </Stack>
              </Box>
            )}
          </Box>
        </ModalBody>

        {/* =================================
            FOOTER
        ================================= */}

        <ModalFooter
          px={{
            base: "18px",
            md: "24px",
          }}
          pt="9px"
          pb="19px"
          borderTopWidth="0"
        >
          <Button
            ml="auto"
            w={{
              base: "100%",
              md: "245px",
            }}
            h="40px"
            bg={ORANGE}
            color="white"
            borderRadius="8px"
            fontSize="11px"
            fontWeight="900"
            _hover={{
              bg:
                ORANGE_DARK,
            }}
            _active={{
              bg:
                ORANGE_DARK,
            }}
            onClick={
              onGoMyPage
            }
          >
            마이페이지로 이동
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}