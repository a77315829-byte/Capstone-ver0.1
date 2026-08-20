import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Progress,
  SimpleGrid,
  Spacer,
  Stack,
  Text,
} from "@chakra-ui/react";

/* =========================================================
   TYPES
========================================================= */

type TurnMetricEvaluation = {
  metric?: string;
  score?: number;
  reason?: string;
  feedback?: string;

  penalties?: Array<{
    cause?: string;
    evidence?: string;
  }>;
};

type TurnGuidanceAction = {
  guidance_code?: string;
  kind?: string;
  message?: string;
  source_turn?: number;
  target_metrics?: string[];
  trigger_causes?: string[];
  check_causes?: string[];
};

type TurnGuidanceReview = {
  guidance_code?: string;
  message?: string;
  source_turn?: number;
  evaluated_turn?: number;

  status?:
    | "FOLLOWED"
    | "REPEATED"
    | "NOT_VERIFIABLE"
    | string;

  evidence?: string;

  target_scores?: Record<
    string,
    number
  >;
};

type TurnFeedbackData = {
  good_points?: string[];

  missed_points?: string[];

  explanation?: string;

  next_actions?: TurnGuidanceAction[];

  previous_guidance_review?: TurnGuidanceReview[];
};

type TurnEvaluation = {
  evaluation_id?: string;

  turn_no?: number;

  scorecard?: {
    turn_score?: number;

    metrics?: TurnMetricEvaluation[];

    feedback?:
      | TurnFeedbackData
      | string
      | null;
  };
};

type TransitionInfo = {
  turnNo: number;

  currentDate: string;

  nextTurn: number;

  nextDate?:
    | string
    | null;
};

type Props = {
  isOpen: boolean;

  onContinue: () => void;

  evaluation:
    | TurnEvaluation
    | null;

  info:
    | TransitionInfo
    | null;

  isFinalTurn: boolean;
};

/* =========================================================
   COLORS
========================================================= */

const ORANGE = "#F36F2A";

const ORANGE_DARK = "#D95E20";

const ORANGE_SOFT = "#FFF3EA";

const TEXT = "#29231E";

const MUTED = "#8C8177";

const SUBTLE = "#675D54";

const BORDER = "#E8DCCE";

const GREEN = "#3B8656";

const GREEN_SOFT = "#F1F8F3";

const RED = "#D95C4F";

const RED_SOFT = "#FFF3F1";

/* =========================================================
   LABELS
========================================================= */

const METRIC_LABELS: Record<
  string,
  string
> = {
  M1: "핵심 요인 식별",
  M2: "정보 해석",
  M3: "위험 인식",
  M4: "행동 근거 합리성",
  M5: "논리 일관성",
  PORTFOLIO:
    "포트폴리오 관리",
};

/* =========================================================
   HELPERS
========================================================= */

function numberValue(
  value: unknown,
  fallback = 0,
) {
  if (
    typeof value === "number" &&
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

function normalizeTurnFeedback(
  value: unknown,
): TurnFeedbackData {
  if (!value) {
    return {};
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as TurnFeedbackData;
  }

  if (
    typeof value === "string"
  ) {
    const trimmed =
      value.trim();

    if (!trimmed) {
      return {};
    }

    try {
      const parsed =
        JSON.parse(trimmed);

      if (
        parsed &&
        typeof parsed ===
          "object" &&
        !Array.isArray(
          parsed,
        )
      ) {
        return parsed as TurnFeedbackData;
      }
    } catch {
      // JSON이 아닌 일반 문자열이면
      // 그대로 해설로 사용
    }

    return {
      explanation: trimmed,
    };
  }

  return {};
}

function formatDate(
  value?:
    | string
    | null,
) {
  if (!value) {
    return "-";
  }

  const normalized =
    value.slice(0, 10);

  const [
    year,
    month,
    day,
  ] =
    normalized.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

function scoreColor(
  score: number,
) {
  if (score >= 4) {
    return GREEN;
  }

  if (score >= 3) {
    return ORANGE;
  }

  return RED;
}

function scoreBg(
  score: number,
) {
  if (score >= 4) {
    return GREEN_SOFT;
  }

  if (score >= 3) {
    return ORANGE_SOFT;
  }

  return RED_SOFT;
}

function scoreText(
  score: number,
) {
  if (score >= 4.5) {
    return "매우 좋음";
  }

  if (score >= 4) {
    return "좋음";
  }

  if (score >= 3) {
    return "보통";
  }

  return "보완 필요";
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  metric,
}: {
  metric: TurnMetricEvaluation;
}) {
  const id =
    String(
      metric.metric ?? "",
    );

  const score =
    numberValue(metric.score);

  const color =
    scoreColor(score);

  return (
    <Box
      minW="0"
      px="10px"
      py="11px"
      bg="white"
      borderWidth="1px"
      borderColor={BORDER}
      borderRadius="9px"
    >
      <Text
        minH="25px"
        fontSize="8px"
        fontWeight="900"
        lineHeight="1.45"
        textAlign="center"
        color="#625950"
        noOfLines={2}
      >
        {METRIC_LABELS[id] ??
          id}
      </Text>

      <Flex
        mt="7px"
        justify="center"
        align="baseline"
      >
        <Text
          fontSize="18px"
          lineHeight="1"
          fontWeight="900"
          color={color}
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

      <Progress
        mt="9px"
        value={
          Math.max(
            0,
            Math.min(
              100,
              (score / 5) *
                100,
            ),
          )
        }
        h="4px"
        bg="#EEE8E2"
        borderRadius="full"
        sx={{
          "& > div": {
            background:
              color,

            borderRadius:
              "999px",
          },
        }}
      />

      <Text
        mt="6px"
        textAlign="center"
        fontSize="7px"
        fontWeight="800"
        color={color}
      >
        {scoreText(score)}
      </Text>
    </Box>
  );
}

/* =========================================================
   FEEDBACK CARD
========================================================= */

function FeedbackCard({
  title,
  icon,
  items,
  emptyText,
  iconBg,
}: {
  title: string;

  icon: string;

  items: string[];

  emptyText: string;

  iconBg: string;
}) {
  return (
    <Box
      p="14px"
      minH="145px"
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
          w="25px"
          h="25px"
          align="center"
          justify="center"
          bg={iconBg}
          borderRadius="7px"
          flexShrink={0}
        >
          <Image
            src={icon}
            alt=""
            w="15px"
            h="15px"
            objectFit="contain"
          />
        </Flex>

        <Text
          fontSize="11px"
          fontWeight="900"
          color={TEXT}
        >
          {title}
        </Text>
      </Flex>

      <Stack
        mt="11px"
        spacing="8px"
      >
        {items.length >
        0 ? (
          items
            .slice(0, 4)
            .map(
              (
                item,
                index,
              ) => (
                <Flex
                  key={`${item}-${index}`}
                  gap="7px"
                  align="flex-start"
                >
                  <Box
                    mt="5px"
                    w="4px"
                    h="4px"
                    borderRadius="full"
                    bg={ORANGE}
                    flexShrink={0}
                  />

                  <Text
                    fontSize="9px"
                    lineHeight="1.6"
                    color={SUBTLE}
                  >
                    {item}
                  </Text>
                </Flex>
              ),
            )
        ) : (
          <Text
            fontSize="9px"
            lineHeight="1.65"
            color={MUTED}
          >
            {emptyText}
          </Text>
        )}
      </Stack>
    </Box>
  );
}

/* =========================================================
   PREVIOUS REVIEW
========================================================= */

function PreviousReviewCard({
  review,
}: {
  review: TurnGuidanceReview;
}) {
  const followed =
    review.status ===
    "FOLLOWED";

  const repeated =
    review.status ===
    "REPEATED";

  const label =
    followed
      ? "반영"
      : repeated
        ? "반복"
        : "확인 필요";

  const color =
    followed
      ? GREEN
      : repeated
        ? RED
        : MUTED;

  const bg =
    followed
      ? GREEN_SOFT
      : repeated
        ? RED_SOFT
        : "#F4F1EE";

  return (
    <Flex
      gap="10px"
      align="flex-start"
    >
      <Badge
        flexShrink={0}
        mt="1px"
        px="7px"
        py="3px"
        bg={bg}
        color={color}
        borderRadius="6px"
        fontSize="7px"
        fontWeight="900"
      >
        {label}
      </Badge>

      <Box minW="0">
        {review.message && (
          <Text
            fontSize="9px"
            lineHeight="1.55"
            fontWeight="800"
            color={TEXT}
          >
            {review.message}
          </Text>
        )}

        {review.evidence && (
          <Text
            mt="3px"
            fontSize="8px"
            lineHeight="1.55"
            color={MUTED}
          >
            {review.evidence}
          </Text>
        )}
      </Box>
    </Flex>
  );
}

/* =========================================================
   MAIN
========================================================= */

export default function TurnFeedbackModal({
  isOpen,
  onContinue,
  evaluation,
  info,
  isFinalTurn,
}: Props) {
  if (
    !evaluation?.scorecard
  ) {
    return null;
  }

  const scorecard =
    evaluation.scorecard;

  const feedback =
    normalizeTurnFeedback(
      scorecard.feedback,
    );

  const turnNo =
    evaluation.turn_no ??
    info?.turnNo ??
    0;

  const turnScore =
    numberValue(
      scorecard.turn_score,
    );

  const metrics =
    (
      scorecard.metrics ?? []
    )
      .filter(
        (metric) =>
          Boolean(
            metric.metric,
          ) &&
          Number.isFinite(
            numberValue(
              metric.score,
            ),
          ),
      )
      .slice(0, 5);

  const goodPoints =
    (
      feedback.good_points ??
      []
    ).filter(Boolean);

  const missedPoints =
    (
      feedback.missed_points ??
      []
    ).filter(Boolean);

  const nextActions =
    (
      feedback.next_actions ??
      []
    ).filter(
      (item) =>
        Boolean(
          item?.message,
        ),
    );

  const previousReviews =
    (
      feedback.previous_guidance_review ??
      []
    ).filter(
      (item) =>
        Boolean(
          item?.message ||
            item?.evidence,
        ),
    );

  const mainScoreColor =
    scoreColor(turnScore);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() =>
        undefined
      }
      isCentered
      size="4xl"
      closeOnOverlayClick={
        false
      }
      closeOnEsc={false}
    >
      <ModalOverlay
        bg="rgba(35, 31, 27, 0.50)"
        backdropFilter="blur(1px)"
      />

      <ModalContent
        w={{
          base:
            "calc(100% - 24px)",

          md:
            "760px",
        }}
        maxW="760px"
        maxH="92vh"
        bg="#FFFDF9"
        borderRadius="14px"
        borderWidth="1px"
        borderColor={BORDER}
        overflow="hidden"
        boxShadow="0 22px 60px rgba(40, 31, 24, 0.20)"
      >
        {/* =================================
            BODY
        ================================= */}

        <ModalBody
          px={{
            base: "18px",
            md: "25px",
          }}
          pt="23px"
          pb="18px"
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
                  "#D8D0C8",

                borderRadius:
                  "20px",
              },
          }}
        >
          {/* =================================
              TOP RESULT
          ================================= */}

          <Flex
            direction="column"
            align="center"
            textAlign="center"
          >
            <Image
              src="/icons/verified.svg"
              alt="TURN 완료"
              w="34px"
              h="34px"
              objectFit="contain"
            />

            <Badge
              mt="9px"
              px="9px"
              py="4px"
              bg={ORANGE_SOFT}
              color={ORANGE}
              borderRadius="full"
              fontSize="8px"
              fontWeight="900"
            >
              TURN {turnNo} 분석 완료
            </Badge>

            <Text
              mt="8px"
              fontSize={{
                base: "18px",
                md: "21px",
              }}
              fontWeight="900"
              letterSpacing="-0.04em"
              color={TEXT}
            >
              이번 TURN의 판단을
              분석했습니다
            </Text>

            <Text
              mt="5px"
              fontSize="9px"
              lineHeight="1.65"
              color={MUTED}
            >
              수익률이 아닌,
              선택한 정보와 판단
              근거를 기준으로
              평가합니다.
            </Text>
          </Flex>

          {/* =================================
              SCORE
          ================================= */}

          <Box
            mt="17px"
            p="15px"
            bg={scoreBg(
              turnScore,
            )}
            borderWidth="1px"
            borderColor={`${mainScoreColor}30`}
            borderRadius="11px"
          >
            <Flex
              align="center"
              justify="center"
              gap="17px"
            >
              <Box
                textAlign="center"
              >
                <Text
                  fontSize="8px"
                  fontWeight="800"
                  color={MUTED}
                >
                  이번 TURN 점수
                </Text>

                <Flex
                  mt="4px"
                  justify="center"
                  align="baseline"
                >
                  <Text
                    fontSize="30px"
                    lineHeight="1"
                    fontWeight="900"
                    color={
                      mainScoreColor
                    }
                  >
                    {turnScore.toFixed(
                      1,
                    )}
                  </Text>

                  <Text
                    ml="3px"
                    fontSize="10px"
                    color={MUTED}
                  >
                    / 5
                  </Text>
                </Flex>
              </Box>

              <Box
                h="40px"
                borderLeftWidth="1px"
                borderColor={`${mainScoreColor}25`}
              />

              <Box>
                <Text
                  fontSize="9px"
                  fontWeight="900"
                  color={
                    mainScoreColor
                  }
                >
                  {scoreText(
                    turnScore,
                  )}
                </Text>

                <Text
                  mt="3px"
                  fontSize="8px"
                  lineHeight="1.5"
                  color={MUTED}
                >
                  판단 과정 종합 평가
                </Text>
              </Box>
            </Flex>
          </Box>

          {/* =================================
              METRICS
          ================================= */}

          {metrics.length >
            0 && (
            <Box mt="17px">
              <Flex
                mb="8px"
                align="center"
              >
                <Text
                  fontSize="11px"
                  fontWeight="900"
                  color={TEXT}
                >
                  항목별 평가
                </Text>

                <Spacer />

                <Text
                  fontSize="8px"
                  color={MUTED}
                >
                  5점 만점
                </Text>
              </Flex>

              <SimpleGrid
                columns={{
                  base: 2,
                  sm: 3,
                  md:
                    metrics.length,
                }}
                spacing="7px"
              >
                {metrics.map(
                  (
                    metric,
                    index,
                  ) => (
                    <MetricCard
                      key={`${metric.metric}-${index}`}
                      metric={
                        metric
                      }
                    />
                  ),
                )}
              </SimpleGrid>
            </Box>
          )}

          {/* =================================
              EXPLANATION
          ================================= */}

          <Box
            mt="12px"
            p="14px"
            bg="#FFF8F2"
            borderWidth="1px"
            borderColor="#F0D7C5"
            borderRadius="10px"
          >
            <Flex
              align="flex-start"
              gap="9px"
            >
              <Flex
                w="27px"
                h="27px"
                align="center"
                justify="center"
                bg="white"
                borderRadius="7px"
                flexShrink={0}
              >
                <Image
                  src="/icons/book.svg"
                  alt=""
                  w="15px"
                  h="15px"
                  objectFit="contain"
                />
              </Flex>

              <Box>
                <Text
                  fontSize="10px"
                  fontWeight="900"
                  color={TEXT}
                >
                  이번 TURN 해설
                </Text>

                <Text
                  mt="5px"
                  fontSize="9px"
                  lineHeight="1.75"
                  color={SUBTLE}
                >
                  {feedback.explanation ||
                    "이번 TURN의 판단 기록을 분석했습니다. 다음 TURN에서는 낮게 평가된 항목과 놓친 위험 요인을 함께 확인해보세요."}
                </Text>
              </Box>
            </Flex>
          </Box>

          {/* =================================
              GOOD / MISSED
          ================================= */}

          <SimpleGrid
            mt="11px"
            columns={{
              base: 1,
              md: 2,
            }}
            spacing="9px"
          >
            <FeedbackCard
              title="잘 본 요소"
              icon="/icons/verified.svg"
              iconBg={GREEN_SOFT}
              items={
                goodPoints
              }
              emptyText="이번 TURN에서 별도로 강조된 강점은 없습니다."
            />

            <FeedbackCard
              title="놓친 요소"
              icon="/icons/warning.svg"
              iconBg={RED_SOFT}
              items={
                missedPoints
              }
              emptyText="이번 TURN에서 추가로 확인된 주요 누락 요소는 없습니다."
            />
          </SimpleGrid>

          {/* =================================
              PREVIOUS FEEDBACK REVIEW
          ================================= */}

          {previousReviews.length >
            0 && (
            <Box
              mt="10px"
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
                <Text
                  fontSize="11px"
                  fontWeight="900"
                  color={TEXT}
                >
                  이전 TURN 피드백 반영
                </Text>

                <Badge
                  bg="#F4EFEA"
                  color={MUTED}
                  fontSize="7px"
                  borderRadius="full"
                >
                  {
                    previousReviews.length
                  }
                  개
                </Badge>
              </Flex>

              <Stack
                mt="11px"
                spacing="11px"
              >
                {previousReviews
                  .slice(
                    0,
                    3,
                  )
                  .map(
                    (
                      review,
                      index,
                    ) => (
                      <PreviousReviewCard
                        key={`${review.guidance_code ?? "review"}-${index}`}
                        review={
                          review
                        }
                      />
                    ),
                  )}
              </Stack>
            </Box>
          )}

          {/* =================================
              NEXT TURN
          ================================= */}

          <Box
            mt="10px"
            p="14px"
            bg={ORANGE_SOFT}
            borderWidth="1px"
            borderColor="#F0D1BC"
            borderRadius="10px"
          >
            <Flex
              align="center"
              gap="8px"
            >
              <Flex
                w="27px"
                h="27px"
                align="center"
                justify="center"
                bg="white"
                borderRadius="7px"
                flexShrink={0}
              >
                <Image
                  src="/icons/flag.svg"
                  alt=""
                  w="15px"
                  h="15px"
                  objectFit="contain"
                />
              </Flex>

              <Box>
                <Text
                  fontSize="11px"
                  fontWeight="900"
                  color={TEXT}
                >
                  {isFinalTurn
                    ? "다음 투자에서 적용할 점"
                    : "다음 TURN에서 확인할 점"}
                </Text>

                {!isFinalTurn &&
                  info?.nextDate && (
                  <Text
                    mt="2px"
                    fontSize="8px"
                    color={MUTED}
                  >
                    TURN{" "}
                    {
                      info.nextTurn
                    }{" "}
                    ·{" "}
                    {formatDate(
                      info.nextDate,
                    )}
                  </Text>
                )}
              </Box>
            </Flex>

            <Stack
              mt="11px"
              spacing="8px"
            >
              {nextActions.length >
              0 ? (
                nextActions
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
                        key={`${action.guidance_code ?? "action"}-${index}`}
                        align="flex-start"
                        gap="8px"
                      >
                        <Flex
                          mt="1px"
                          w="17px"
                          h="17px"
                          align="center"
                          justify="center"
                          bg={ORANGE}
                          color="white"
                          borderRadius="full"
                          fontSize="7px"
                          fontWeight="900"
                          flexShrink={
                            0
                          }
                        >
                          {index +
                            1}
                        </Flex>

                        <Text
                          fontSize="9px"
                          lineHeight="1.65"
                          color={SUBTLE}
                        >
                          {
                            action.message
                          }
                        </Text>
                      </Flex>
                    ),
                  )
              ) : (
                <Text
                  fontSize="9px"
                  lineHeight="1.65"
                  color={SUBTLE}
                >
                  {isFinalTurn
                    ? "이번 시나리오에서 확인한 판단 패턴을 실제 투자에서도 점검해보세요."
                    : "다음 TURN에서도 현재 시장 정보와 위험 요인을 함께 확인한 뒤 판단해보세요."}
                </Text>
              )}
            </Stack>
          </Box>

          {/* =================================
              TIME TRANSITION
          ================================= */}

          {!isFinalTurn &&
            info && (
            <Grid
              mt="10px"
              templateColumns="1fr 28px 1fr"
              alignItems="center"
              px="14px"
              py="11px"
              bg="#F8F5F1"
              borderRadius="9px"
            >
              <Box
                textAlign="center"
              >
                <Text
                  fontSize="7px"
                  color={MUTED}
                >
                  현재 시점
                </Text>

                <Text
                  mt="2px"
                  fontSize="9px"
                  fontWeight="900"
                  color={TEXT}
                >
                  {formatDate(
                    info.currentDate,
                  )}
                </Text>
              </Box>

              <Text
                textAlign="center"
                fontSize="12px"
                color={ORANGE}
              >
                →
              </Text>

              <Box
                textAlign="center"
              >
                <Text
                  fontSize="7px"
                  color={MUTED}
                >
                  다음 시점
                </Text>

                <Text
                  mt="2px"
                  fontSize="9px"
                  fontWeight="900"
                  color={TEXT}
                >
                  {formatDate(
                    info.nextDate,
                  )}
                </Text>
              </Box>
            </Grid>
          )}
        </ModalBody>

        {/* =================================
            FOOTER
        ================================= */}

        <ModalFooter
          px={{
            base: "18px",
            md: "25px",
          }}
          pt="13px"
          pb="19px"
          bg="white"
          borderTopWidth="1px"
          borderColor="#EEE6DE"
        >
          <Button
            ml="auto"
            w={{
              base: "100%",
              md: "260px",
            }}
            h="41px"
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
              onContinue
            }
          >
            {isFinalTurn
              ? "종합 평가 결과 보기"
              : "다음 TURN으로"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}