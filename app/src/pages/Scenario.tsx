import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Spacer,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";

import { useNavigate } from "react-router-dom";

import scenarioService from "../services/scenario.service";
import tokens from "../services/tokens.service";

/* =========================================================
   TYPES
========================================================= */

type ScenarioApiItem = {
  scenario_id: string;
  version: number;
  title: string;
  description: string;
  difficulty: string;
  total_turns: number;
  initial_cash: number;

  event_period?: string;

  initial_portfolio_label?: string;

  learning_points: string[];
};

type ScenarioStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED";

type ScenarioItem = {
  _id: string;

  scenarioSlug: string;

  title: string;

  eventPeriod: string;

  initialPortfolioLabel: string;

  summary: string;

  difficulty:
    | "쉬움"
    | "보통"
    | "어려움";

  estimatedMinutes: number;

  totalTurns: number;

  learningPoints: string[];

  status: ScenarioStatus;

  completedStepCount: number;

  sessionId?:
    | string
    | null;

  progressPercent: number;

  updatedAt?:
    | string
    | null;
};

/* =========================================================
   COLORS
========================================================= */

const BG = "#FDFAF4";

const SURFACE = "#FFFCF8";

const WHITE = "#FFFFFF";

const TEXT = "#211C18";

const MUTED = "#81766D";

const SUBTLE = "#625950";

const BORDER = "#E7DCCE";

const ORANGE = "#F36F2A";

const ORANGE_DARK = "#D95E20";

const ORANGE_SOFT = "#FFF3EA";

const GREEN = "#4F9B63";

const GREEN_SOFT = "#EFF8F1";

/* =========================================================
   HELPERS
========================================================= */

function getScenarioYear(
  eventPeriod: string,
) {
  const match =
    eventPeriod?.match(
      /(?:19|20)\d{2}/,
    );

  return match?.[0] ?? "과거";
}

/**
 * 화면에서는 반드시
 *
 * 2022 → 2022년
 */
function getScenarioYearLabel(
  eventPeriod: string,
) {
  const year =
    getScenarioYear(
      eventPeriod,
    );

  if (year === "과거") {
    return year;
  }

  return `${year}년`;
}

function normalizeDifficulty(
  value: string,
): ScenarioItem["difficulty"] {
  if (
    value === "쉬움" ||
    value === "보통" ||
    value === "어려움"
  ) {
    return value;
  }

  const normalized =
    value.toLowerCase();

  if (
    normalized === "easy"
  ) {
    return "쉬움";
  }

  if (
    normalized === "hard"
  ) {
    return "어려움";
  }

  return "보통";
}

function difficultyLevel(
  difficulty: ScenarioItem["difficulty"],
) {
  if (
    difficulty === "어려움"
  ) {
    return 4;
  }

  if (
    difficulty === "보통"
  ) {
    return 3;
  }

  return 2;
}

function statusLabel(
  status: ScenarioStatus,
) {
  if (
    status === "IN_PROGRESS"
  ) {
    return "진행 중";
  }

  if (
    status === "COMPLETED"
  ) {
    return "완료";
  }

  return "미시작";
}

function formatDate(
  value?:
    | string
    | null,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  );
}

/* =========================================================
   DIFFICULTY DOTS
========================================================= */

function DifficultyDots({
  difficulty,
  size = "8px",
}: {
  difficulty: ScenarioItem["difficulty"];

  size?: string;
}) {
  const level =
    difficultyLevel(
      difficulty,
    );

  return (
    <HStack spacing="4px">
      {[1, 2, 3, 4, 5].map(
        (dot) => (
          <Box
            key={dot}
            w={size}
            h={size}
            borderRadius="full"
            bg={
              dot <= level
                ? ORANGE
                : "#D9D4CE"
            }
          />
        ),
      )}
    </HStack>
  );
}

/* =========================================================
   RACE TRACK
========================================================= */

function RaceTrackBackground() {
  /**
   * 개미 위치.
   *
   * 디자이너가 준 race-track.png 위에
   * 실제 ant.png를 배치한다.
   */
  const ants = [
    {
      left: "8%",
      top: "50%",
      rotate:
        "-25deg",
    },

    {
      left: "24%",
      top: "41%",
      rotate:
        "24deg",
    },

    {
      left: "43%",
      top: "55%",
      rotate:
        "-10deg",
    },

    {
      left: "69%",
      top: "40%",
      rotate:
        "12deg",
    },

    {
      left: "82%",
      top: "51%",
      rotate:
        "28deg",
    },
  ];

  return (
    <Box
      position="absolute"
      inset="0"
      pointerEvents="none"
      overflow="hidden"
      zIndex={0}
    >
      {/* =========================
          실제 레이스 트랙
      ========================= */}

      <Image
        position="absolute"
        left="5%"
        top="10%"
        w="90%"
        h="78%"
        src="/scenario/race-track.png"
        alt=""
        objectFit="contain"
        opacity={0.95}
      />

      {/* =========================
          출발 깃발
      ========================= */}

      <Image
        position="absolute"
        left="7%"
        top="46%"
        w="17px"
        h="17px"
        src="/icons/flag.svg"
        alt=""
        objectFit="contain"
      />

      {/* =========================
          도착 깃발
      ========================= */}

      <Image
        position="absolute"
        right="9%"
        top="42%"
        w="17px"
        h="17px"
        src="/icons/flag.svg"
        alt=""
        objectFit="contain"
      />

      {/* =========================
          실제 검은 개미
      ========================= */}

      {ants.map(
        (ant, index) => (
          <Image
            key={index}
            position="absolute"
            left={ant.left}
            top={ant.top}
            src="/scenario/ant.png"
            alt=""
            w="17px"
            h="17px"
            objectFit="contain"
            transform={`rotate(${ant.rotate})`}
          />
        ),
      )}
    </Box>
  );
}

/* =========================================================
   CENTER SCENARIO
========================================================= */

function CenterScenarioBubble({
  scenario,
  onClick,
}: {
  scenario: ScenarioItem;

  onClick: () => void;
}) {
  const buttonLabel =
    scenario.status ===
    "IN_PROGRESS"
      ? "이어하기"
      : scenario.status ===
          "COMPLETED"
        ? "결과 보기"
        : "시작하기";

  return (
    <Button
      position="absolute"
      left="50%"
      top="48%"
      transform="translate(-50%, -50%)"
      w="218px"
      h="218px"
      minW="218px"
      p="17px"
      bg={SURFACE}
      borderWidth="2px"
      borderColor={ORANGE}
      borderRadius="full"
      whiteSpace="normal"
      boxShadow="0 10px 26px rgba(243,111,42,.08)"
      zIndex={3}
      transition="all .18s ease"
      _hover={{
        bg:
          "#FFF9F4",

        transform:
          "translate(-50%, -50%) scale(1.02)",
      }}
      _active={{
        transform:
          "translate(-50%, -50%) scale(1)",
      }}
      onClick={onClick}
    >
      <Stack
        spacing="5px"
        align="center"
      >
        {/* 개미 */}

        <Image
          src="/scenario/ant.png"
          alt=""
          w="18px"
          h="18px"
          objectFit="contain"
        />

        {/* 연도 */}

        <Text
          fontSize="12px"
          fontWeight="900"
          color={ORANGE}
        >
          {getScenarioYearLabel(
            scenario.eventPeriod,
          )}
        </Text>

        {/* 제목 */}

        <Text
          maxW="160px"
          fontSize="20px"
          lineHeight="1.28"
          fontWeight="900"
          color={TEXT}
          letterSpacing="-0.035em"
          noOfLines={3}
        >
          {scenario.title}
        </Text>

        {/* turn */}

        <Text
          fontSize="11px"
          fontWeight="700"
          color={SUBTLE}
        >
          총 {scenario.totalTurns} TURN
        </Text>

        {/* 난이도 */}

        <DifficultyDots
          difficulty={
            scenario.difficulty
          }
          size="8px"
        />

        {/* 버튼 */}

        <Button
          mt="3px"
          h="32px"
          px="17px"
          variant="outline"
          borderColor={ORANGE}
          color={ORANGE}
          bg={WHITE}
          borderRadius="7px"
          fontSize="12px"
          fontWeight="900"
          pointerEvents="none"
        >
          {buttonLabel}
        </Button>
      </Stack>
    </Button>
  );
}

/* =========================================================
   ORBIT SCENARIOS
========================================================= */

const ORBIT_POSITIONS = [
  {
    left: "18%",
    top: "29%",
    size: 155,
  },

  {
    left: "18%",
    top: "72%",
    size: 150,
  },

  {
    left: "82%",
    top: "29%",
    size: 155,
  },

  {
    left: "80%",
    top: "72%",
    size: 150,
  },

  {
    left: "50%",
    top: "84%",
    size: 143,
  },
];

function OrbitScenarioBubble({
  scenario,
  index,
  onSelect,
}: {
  scenario: ScenarioItem;

  index: number;

  onSelect: () => void;
}) {
  /**
   * ORBIT_POSITIONS가 항상 존재하므로
   * ! 로 undefined 가능성 제거.
   */
  const position =
    ORBIT_POSITIONS[
      index %
        ORBIT_POSITIONS.length
    ]!;

  return (
    <Button
      position="absolute"
      left={position.left}
      top={position.top}
      transform="translate(-50%, -50%)"
      w={`${position.size}px`}
      h={`${position.size}px`}
      minW="0"
      p="13px"
      borderRadius="full"
      whiteSpace="normal"
      bg={SURFACE}
      borderWidth="1px"
      borderColor="#CEC7BF"
      boxShadow="0 4px 12px rgba(40,29,21,.025)"
      zIndex={2}
      transition="all .16s ease"
      _hover={{
        borderColor:
          ORANGE,

        bg:
          "#FFF9F4",

        transform:
          "translate(-50%, -50%) translateY(-3px)",
      }}
      onClick={
        onSelect
      }
    >
      <Stack
        spacing="5px"
        align="center"
      >
        {/* 연도 */}

        <Text
          fontSize="11px"
          fontWeight="900"
          color={ORANGE}
        >
          {getScenarioYearLabel(
            scenario.eventPeriod,
          )}
        </Text>

        {/* 제목 */}

        <Text
          maxW="115px"
          fontSize="15px"
          lineHeight="1.3"
          fontWeight="900"
          color={TEXT}
          noOfLines={3}
        >
          {scenario.title}
        </Text>

        {/* turn */}

        <Text
          fontSize="10px"
          fontWeight="700"
          color={SUBTLE}
        >
          총 {scenario.totalTurns} TURN
        </Text>

        {/* 난이도 */}

        <DifficultyDots
          difficulty={
            scenario.difficulty
          }
          size="7px"
        />

        {/* 상태 */}

        {scenario.status !==
          "NOT_STARTED" && (
          <Badge
            mt="2px"
            px="6px"
            py="2px"
            borderRadius="full"
            fontSize="7px"
            bg={
              scenario.status ===
              "COMPLETED"
                ? GREEN_SOFT
                : ORANGE_SOFT
            }
            color={
              scenario.status ===
              "COMPLETED"
                ? GREEN
                : ORANGE
            }
          >
            {statusLabel(
              scenario.status,
            )}
          </Badge>
        )}
      </Stack>
    </Button>
  );
}

/* =========================================================
   MOBILE SCENARIO
========================================================= */

function MobileScenarioCard({
  scenario,
  selected,
  onClick,
}: {
  scenario: ScenarioItem;

  selected: boolean;

  onClick: () => void;
}) {
  return (
    <Button
      h="auto"
      minH="135px"
      p="15px"
      whiteSpace="normal"
      bg={
        selected
          ? ORANGE_SOFT
          : WHITE
      }
      borderWidth="1px"
      borderColor={
        selected
          ? ORANGE
          : BORDER
      }
      borderRadius="10px"
      onClick={onClick}
    >
      <Flex
        w="100%"
        direction="column"
        align="flex-start"
      >
        <Flex
          w="100%"
          align="center"
        >
          <Flex
            align="center"
            gap="6px"
          >
            <Image
              src="/scenario/ant.png"
              alt=""
              w="14px"
              h="14px"
            />

            <Text
              fontSize="11px"
              fontWeight="900"
              color={ORANGE}
            >
              {getScenarioYearLabel(
                scenario.eventPeriod,
              )}
            </Text>
          </Flex>

          <Spacer />

          <Badge
            px="6px"
            py="2px"
            fontSize="7px"
            borderRadius="full"
            bg={
              scenario.status ===
              "COMPLETED"
                ? GREEN_SOFT
                : "#F5F0EA"
            }
            color={
              scenario.status ===
              "COMPLETED"
                ? GREEN
                : MUTED
            }
          >
            {statusLabel(
              scenario.status,
            )}
          </Badge>
        </Flex>

        <Text
          mt="8px"
          fontSize="16px"
          fontWeight="900"
          color={TEXT}
          textAlign="left"
        >
          {scenario.title}
        </Text>

        <Flex
          mt="9px"
          align="center"
          gap="9px"
        >
          <DifficultyDots
            difficulty={
              scenario.difficulty
            }
          />

          <Text
            fontSize="10px"
            color={MUTED}
          >
            {scenario.totalTurns} TURN
          </Text>
        </Flex>
      </Flex>
    </Button>
  );
}

/* =========================================================
   SCENARIO DETAIL
========================================================= */

function ScenarioDetail({
  scenario,
  onStart,
  isStarting,
}: {
  scenario: ScenarioItem;

  onStart: () => void;

  isStarting: boolean;
}) {
  const buttonLabel =
    scenario.status ===
    "IN_PROGRESS"
      ? "시나리오 이어하기"
      : scenario.status ===
          "COMPLETED"
        ? "결과 보기"
        : "시나리오 시작하기";

  return (
    <Flex
      h="100%"
      minH="580px"
      direction="column"
      p="20px"
      bg={WHITE}
      borderWidth="1px"
      borderColor={ORANGE}
      borderRadius="12px"
    >
      {/* =========================
          TOP
      ========================= */}

      <Flex
        align="flex-start"
      >
        <Badge
          px="8px"
          py="4px"
          bg={ORANGE_SOFT}
          color={ORANGE}
          borderRadius="6px"
          fontSize="9px"
          fontWeight="900"
        >
          선택된 시나리오
        </Badge>

        <Spacer />

        <Text
          fontSize="21px"
          lineHeight="1"
          color="#AEA49B"
        >
          ♧
        </Text>
      </Flex>

      {/* =========================
          TITLE
      ========================= */}

      <Text
        mt="15px"
        fontSize="29px"
        lineHeight="1.24"
        fontWeight="900"
        color={TEXT}
        letterSpacing="-0.04em"
      >
        {scenario.title}
      </Text>

      {/* 기간 */}

      <Text
        mt="8px"
        fontSize="12px"
        fontWeight="700"
        color={MUTED}
      >
        {scenario.eventPeriod}
      </Text>

      {/* 설명 */}

      <Text
        mt="10px"
        fontSize="13px"
        lineHeight="1.7"
        color={SUBTLE}
        noOfLines={4}
      >
        {scenario.summary}
      </Text>

      {/* =========================
          PROGRESS
      ========================= */}

      {scenario.status ===
        "IN_PROGRESS" && (
        <Box
          mt="14px"
          p="11px"
          bg="#FFF8F2"
          borderRadius="8px"
        >
          <Flex align="center">
            <Text
              fontSize="11px"
              fontWeight="900"
              color={TEXT}
            >
              현재 진행도
            </Text>

            <Spacer />

            <Text
              fontSize="11px"
              fontWeight="900"
              color={ORANGE}
            >
              {Math.round(
                scenario.progressPercent,
              )}
              %
            </Text>
          </Flex>

          <Progress
            mt="7px"
            value={
              scenario.progressPercent
            }
            h="6px"
            bg="#F0E5DC"
            borderRadius="full"
            sx={{
              "& > div": {
                background:
                  ORANGE,

                borderRadius:
                  "999px",
              },
            }}
          />
        </Box>
      )}

      {/* =========================
          META
      ========================= */}

      <Stack
        mt="18px"
        spacing="12px"
      >
        <Flex align="center">
          <Text
            fontSize="12px"
            fontWeight="700"
            color={MUTED}
          >
            시나리오 기간
          </Text>

          <Spacer />

          <Text
            maxW="210px"
            textAlign="right"
            fontSize="12px"
            fontWeight="800"
            color={TEXT}
          >
            {scenario.eventPeriod}
          </Text>
        </Flex>

        <Flex align="center">
          <Text
            fontSize="12px"
            fontWeight="700"
            color={MUTED}
          >
            총 TURN
          </Text>

          <Spacer />

          <Text
            fontSize="12px"
            fontWeight="900"
            color={TEXT}
          >
            {scenario.totalTurns} TURN
          </Text>
        </Flex>

        <Flex align="center">
          <Text
            fontSize="12px"
            fontWeight="700"
            color={MUTED}
          >
            예상 시간
          </Text>

          <Spacer />

          <Text
            fontSize="12px"
            fontWeight="900"
            color={TEXT}
          >
            약{" "}
            {scenario.estimatedMinutes}
            분
          </Text>
        </Flex>

        <Flex
          align="flex-start"
          gap="15px"
        >
          <Text
            flexShrink={0}
            fontSize="12px"
            fontWeight="700"
            color={MUTED}
          >
            시작 자산
          </Text>

          <Spacer />

          <Text
            maxW="220px"
            textAlign="right"
            fontSize="12px"
            lineHeight="1.5"
            fontWeight="900"
            color={ORANGE}
          >
            {
              scenario.initialPortfolioLabel
            }
          </Text>
        </Flex>
      </Stack>

      {/* =========================
          LEARNING POINT
      ========================= */}

      <Box
        mt="18px"
        p="14px"
        bg="#FFFCF8"
        borderWidth="1px"
        borderColor={BORDER}
        borderRadius="9px"
      >
        <Text
          fontSize="13px"
          fontWeight="900"
          color={TEXT}
        >
          학습 포인트
        </Text>

        <Stack
          mt="10px"
          spacing="9px"
        >
          {scenario.learningPoints
            .slice(0, 3)
            .map(
              (
                point,
                index,
              ) => (
                <Flex
                  key={`${point}-${index}`}
                  gap="8px"
                  align="flex-start"
                >
                  <Flex
                    mt="1px"
                    w="17px"
                    h="17px"
                    align="center"
                    justify="center"
                    borderRadius="full"
                    borderWidth="1px"
                    borderColor={ORANGE}
                    color={ORANGE}
                    fontSize="8px"
                    fontWeight="900"
                    flexShrink={0}
                  >
                    ✓
                  </Flex>

                  <Text
                    fontSize="12px"
                    lineHeight="1.6"
                    color={SUBTLE}
                  >
                    {point}
                  </Text>
                </Flex>
              ),
            )}

          {scenario.learningPoints
            .length === 0 && (
            <Text
              fontSize="12px"
              lineHeight="1.6"
              color={MUTED}
            >
              시나리오를 통해
              시장 변화와 투자
              판단 과정을
              학습합니다.
            </Text>
          )}
        </Stack>
      </Box>

      {/* =========================
          NOTICE
      ========================= */}

      <Flex
        mt="13px"
        gap="7px"
        align="flex-start"
      >
        <Box
          mt="6px"
          w="4px"
          h="4px"
          flexShrink={0}
          borderRadius="full"
          bg={ORANGE}
        />

        <Text
          fontSize="10px"
          lineHeight="1.6"
          color={MUTED}
        >
          각 시나리오는 실제 과거
          시장 사건을 바탕으로
          구성됩니다.
        </Text>
      </Flex>

      <Box flex="1" />

      {/* =========================
          BUTTON
      ========================= */}

      <Button
        mt="17px"
        w="100%"
        h="50px"
        bg={ORANGE}
        color="white"
        borderRadius="8px"
        fontSize="15px"
        fontWeight="900"
        isLoading={
          isStarting
        }
        loadingText="불러오는 중"
        _hover={{
          bg:
            ORANGE_DARK,
        }}
        _active={{
          bg:
            ORANGE_DARK,
        }}
        onClick={onStart}
      >
        {buttonLabel}
      </Button>
    </Flex>
  );
}

/* =========================================================
   RECENT SCENARIO
========================================================= */

function RecentScenarioCard({
  scenario,
  onClick,
}: {
  scenario: ScenarioItem;

  onClick: () => void;
}) {
  const completed =
    scenario.status ===
    "COMPLETED";

  const inProgress =
    scenario.status ===
    "IN_PROGRESS";

  const updatedDate =
    formatDate(
      scenario.updatedAt,
    );

  return (
    <Flex
      minW="0"
      p="12px"
      gap="12px"
      bg={WHITE}
      borderWidth="1px"
      borderColor={BORDER}
      borderRadius="9px"
    >
      {/* thumbnail */}

      <Flex
        w="105px"
        minH="90px"
        flexShrink={0}
        align="center"
        justify="center"
        bg="#FBF7F1"
        borderWidth="1px"
        borderColor="#EEE5DB"
        borderRadius="7px"
      >
        <Stack
          spacing="5px"
          align="center"
        >
          <Image
            src="/scenario/ant.png"
            alt=""
            w="18px"
            h="18px"
          />

          <Text
            fontSize="11px"
            fontWeight="900"
            color={ORANGE}
          >
            {getScenarioYearLabel(
              scenario.eventPeriod,
            )}
          </Text>
        </Stack>
      </Flex>

      {/* content */}

      <Flex
        flex="1"
        minW="0"
        direction="column"
      >
        <Flex
          gap="6px"
          align="center"
          wrap="wrap"
        >
          <Badge
            px="6px"
            py="2px"
            bg={
              completed
                ? GREEN_SOFT
                : ORANGE_SOFT
            }
            color={
              completed
                ? GREEN
                : ORANGE
            }
            borderRadius="5px"
            fontSize="8px"
          >
            {statusLabel(
              scenario.status,
            )}
          </Badge>

          <Text
            minW="0"
            fontSize="14px"
            fontWeight="900"
            color={TEXT}
            noOfLines={1}
          >
            {scenario.title}
          </Text>
        </Flex>

        <Text
          mt="6px"
          fontSize="10px"
          lineHeight="1.5"
          color={MUTED}
        >
          {scenario.eventPeriod}

          {updatedDate
            ? ` · ${updatedDate}`
            : ""}
        </Text>

        <Box flex="1" />

        {inProgress ? (
          <>
            <Flex
              mt="9px"
              align="center"
            >
              <Text
                fontSize="10px"
                color={MUTED}
              >
                진행률
              </Text>

              <Spacer />

              <Text
                fontSize="10px"
                fontWeight="900"
                color={ORANGE}
              >
                {Math.round(
                  scenario.progressPercent,
                )}
                %
              </Text>
            </Flex>

            <Progress
              mt="5px"
              value={
                scenario.progressPercent
              }
              h="5px"
              bg="#EFE5DD"
              borderRadius="full"
              sx={{
                "& > div": {
                  background:
                    ORANGE,

                  borderRadius:
                    "999px",
                },
              }}
            />

            <Button
              mt="9px"
              h="32px"
              variant="outline"
              borderColor={ORANGE}
              color={ORANGE}
              borderRadius="6px"
              fontSize="11px"
              fontWeight="900"
              onClick={onClick}
            >
              이어하기
            </Button>
          </>
        ) : (
          <Button
            mt="11px"
            h="32px"
            variant="outline"
            borderColor={
              completed
                ? GREEN
                : ORANGE
            }
            color={
              completed
                ? GREEN
                : ORANGE
            }
            borderRadius="6px"
            fontSize="11px"
            fontWeight="900"
            onClick={onClick}
          >
            {completed
              ? "결과 보기"
              : "시작하기"}
          </Button>
        )}
      </Flex>
    </Flex>
  );
}

/* =========================================================
   LOADING
========================================================= */

function ScenarioLoadingScreen({
  scenario,
  progress,
}: {
  scenario: ScenarioItem;

  progress: number;
}) {
  return (
    <Flex
      minH="calc(100vh - 80px)"
      px="24px"
      py="45px"
      direction="column"
      align="center"
      justify="center"
      bg={BG}
    >
      <Badge
        px="12px"
        py="5px"
        bg={ORANGE}
        color="white"
        borderRadius="7px"
        fontSize="11px"
      >
        {getScenarioYearLabel(
          scenario.eventPeriod,
        )}
      </Badge>

      <Heading
        mt="18px"
        fontSize={{
          base: "29px",
          md: "37px",
        }}
        letterSpacing="-0.04em"
        textAlign="center"
        color={TEXT}
      >
        {scenario.title}
      </Heading>

      <Text
        mt="10px"
        maxW="680px"
        fontSize="13px"
        lineHeight="1.7"
        textAlign="center"
        color={MUTED}
      >
        {scenario.summary}
      </Text>

      <Image
        mt="24px"
        src="/scenario/ant.png"
        alt=""
        w="38px"
        h="38px"
        objectFit="contain"
      />

      <Box
        mt="22px"
        w="100%"
        maxW="520px"
      >
        <Flex
          mb="7px"
          align="center"
        >
          <Text
            fontSize="12px"
            color={MUTED}
          >
            시나리오를 준비하고
            있습니다.
          </Text>

          <Spacer />

          <Text
            fontSize="12px"
            fontWeight="900"
            color={ORANGE}
          >
            {progress}%
          </Text>
        </Flex>

        <Progress
          value={progress}
          h="7px"
          bg="#F0E2D8"
          borderRadius="full"
          sx={{
            "& > div": {
              background:
                ORANGE,

              borderRadius:
                "999px",
            },
          }}
        />
      </Box>
    </Flex>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function Scenario() {
  const navigate =
    useNavigate();

  const toast =
    useToast();

  const [
    scenarios,
    setScenarios,
  ] =
    useState<ScenarioItem[]>(
      [],
    );

  const [
    selectedScenario,
    setSelectedScenario,
  ] =
    useState<ScenarioItem | null>(
      null,
    );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState("전체");

  const [
    selectedDifficulty,
    setSelectedDifficulty,
  ] = useState("전체");

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    launchingScenario,
    setLaunchingScenario,
  ] =
    useState<ScenarioItem | null>(
      null,
    );

  const [
    launchSessionId,
    setLaunchSessionId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    launchProgress,
    setLaunchProgress,
  ] = useState(0);

  const [
    isStartingScenario,
    setIsStartingScenario,
  ] = useState(false);

  /* =======================================================
     LOAD SCENARIOS
  ======================================================= */

  const loadScenarios =
    async () => {
      try {
        setIsLoading(true);

        const userId =
          tokens.getUsername() ||
          "USER-001";

        const [
          scenarioData,
          userProgress,
        ] =
          await Promise.all([
            scenarioService.getScenarios(),

            scenarioService
              .getUserProgress(
                userId,
              )
              .catch(
                (error) => {
                  console.warn(
                    "시나리오 진행도 조회 실패:",
                    error,
                  );

                  return null;
                },
              ),
          ]);

        const apiScenarios:
          ScenarioApiItem[] =
          Array.isArray(
            scenarioData,
          )
            ? scenarioData
            : [];

        const progressMap =
          new Map(
            (
              userProgress?.items ??
              []
            ).map(
              (item) => [
                item.scenario_id,
                item,
              ],
            ),
          );

        const normalized:
          ScenarioItem[] =
          apiScenarios.map(
            (item) => {
              const progress =
                progressMap.get(
                  item.scenario_id,
                );

              return {
                _id:
                  item.scenario_id,

                scenarioSlug:
                  item.scenario_id,

                title:
                  item.title,

                eventPeriod:
                  item.event_period ??
                  "과거 데이터",

                initialPortfolioLabel:
                  item.initial_portfolio_label ??
                  `현금 ${item.initial_cash.toLocaleString(
                    "ko-KR",
                  )}원`,

                summary:
                  item.description,

                difficulty:
                  normalizeDifficulty(
                    item.difficulty,
                  ),

                estimatedMinutes:
                  Math.max(
                    10,
                    item.total_turns *
                      3,
                  ),

                totalTurns:
                  item.total_turns,

                learningPoints:
                  item.learning_points ??
                  [],

                status:
                  progress?.status ??
                  "NOT_STARTED",

                completedStepCount:
                  progress?.completed_turns ??
                  0,

                sessionId:
                  progress?.session_id ??
                  null,

                progressPercent:
                  progress?.progress_percent ??
                  0,

                updatedAt:
                  progress?.updated_at ??
                  null,
              };
            },
          );

        setScenarios(
          normalized,
        );

        /**
         * 진행 중인 시나리오가 있으면
         * 처음부터 그것을 가운데에 표시.
         */
        const active =
          normalized.find(
            (scenario) =>
              scenario.status ===
              "IN_PROGRESS",
          );

        setSelectedScenario(
          active ??
            normalized[0] ??
            null,
        );
      } catch (error) {
        console.error(
          error,
        );

        toast({
          title:
            "시나리오를 불러오지 못했습니다.",

          description:
            "시나리오 서버 연결 상태를 확인하세요.",

          status:
            "error",

          isClosable:
            true,
        });
      } finally {
        setIsLoading(
          false,
        );
      }
    };

  useEffect(() => {
    void loadScenarios();
  }, []);

  /* =======================================================
     YEARS
  ======================================================= */

  const years =
    useMemo(() => {
      return Array.from(
        new Set(
          scenarios.map(
            (scenario) =>
              getScenarioYear(
                scenario.eventPeriod,
              ),
          ),
        ),
      )
        .filter(
          (year) =>
            year !== "과거",
        )
        .sort();
    }, [scenarios]);

  /* =======================================================
     FILTERED
  ======================================================= */

  const filteredScenarios =
    useMemo(() => {
      return scenarios.filter(
        (scenario) => {
          const yearMatch =
            selectedYear ===
              "전체" ||
            getScenarioYear(
              scenario.eventPeriod,
            ) ===
              selectedYear;

          const difficultyMatch =
            selectedDifficulty ===
              "전체" ||
            scenario.difficulty ===
              selectedDifficulty;

          return (
            yearMatch &&
            difficultyMatch
          );
        },
      );
    }, [
      scenarios,
      selectedYear,
      selectedDifficulty,
    ]);

  /* =======================================================
     FILTER CHANGE
  ======================================================= */

  useEffect(() => {
    if (
      selectedScenario &&
      filteredScenarios.some(
        (scenario) =>
          scenario.scenarioSlug ===
          selectedScenario.scenarioSlug,
      )
    ) {
      return;
    }

    setSelectedScenario(
      filteredScenarios[0] ??
        null,
    );
  }, [
    filteredScenarios,
    selectedScenario,
  ]);

  /* =======================================================
     ORBIT
  ======================================================= */

  const orbitScenarios =
    useMemo(() => {
      if (
        !selectedScenario
      ) {
        return [];
      }

      return filteredScenarios
        .filter(
          (scenario) =>
            scenario.scenarioSlug !==
            selectedScenario.scenarioSlug,
        )
        .slice(0, 5);
    }, [
      filteredScenarios,
      selectedScenario,
    ]);

  /* =======================================================
     RECENT
  ======================================================= */

  const recentScenarios =
    useMemo(() => {
      return scenarios
        .filter(
          (scenario) =>
            scenario.status !==
            "NOT_STARTED",
        )
        .sort(
          (a, b) => {
            const aTime =
              a.updatedAt
                ? new Date(
                    a.updatedAt,
                  ).getTime()
                : 0;

            const bTime =
              b.updatedAt
                ? new Date(
                    b.updatedAt,
                  ).getTime()
                : 0;

            return (
              bTime -
              aTime
            );
          },
        )
        .slice(0, 3);
    }, [scenarios]);

  /* =======================================================
     OPEN EXISTING SESSION
  ======================================================= */

  const openSession = (
    scenario: ScenarioItem,
    sessionId: string,
  ) => {
    navigate(
      `/scenario/play/${scenario.scenarioSlug}?sessionId=${encodeURIComponent(
        sessionId,
      )}`,
    );
  };

  /* =======================================================
     START / CONTINUE / RESULT
  ======================================================= */

  const handleStartScenario =
    async (
      scenario: ScenarioItem,
    ) => {
      if (
        isStartingScenario
      ) {
        return;
      }

      /**
       * 진행 중 / 완료된 세션은
       * 기존 sessionId로 이동.
       */
      if (
        scenario.sessionId &&
        (scenario.status ===
          "IN_PROGRESS" ||
          scenario.status ===
            "COMPLETED")
      ) {
        openSession(
          scenario,
          scenario.sessionId,
        );

        return;
      }

      try {
        setIsStartingScenario(
          true,
        );

        const userId =
          tokens.getUsername() ||
          "USER-001";

        const session =
          await scenarioService.createSession(
            scenario.scenarioSlug,
            userId,
          );

        if (
          !session?.session_id
        ) {
          throw new Error(
            "시나리오 서버 응답에 session_id가 없습니다.",
          );
        }

        setLaunchSessionId(
          session.session_id,
        );

        setLaunchProgress(
          0,
        );

        setLaunchingScenario(
          scenario,
        );
      } catch (
        error: any
      ) {
        console.error(
          "시나리오 세션 생성 실패:",
          error,
        );

        toast({
          title:
            "시나리오를 시작하지 못했습니다.",

          description:
            error?.response?.data
              ?.message ||
            error?.response?.data
              ?.detail ||
            "시나리오 세션 생성 중 오류가 발생했습니다.",

          status:
            "error",

          isClosable:
            true,
        });
      } finally {
        setIsStartingScenario(
          false,
        );
      }
    };

  /* =======================================================
     LOADING PROGRESS
  ======================================================= */

  useEffect(() => {
    if (
      !launchingScenario
    ) {
      return;
    }

    setLaunchProgress(
      12,
    );

    const interval =
      window.setInterval(
        () => {
          setLaunchProgress(
            (current) => {
              if (
                current >= 100
              ) {
                return 100;
              }

              return Math.min(
                100,

                current +
                  Math.max(
                    2,

                    Math.round(
                      (100 -
                        current) /
                        8,
                    ),
                  ),
              );
            },
          );
        },
        70,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [launchingScenario]);

  useEffect(() => {
    if (
      !launchingScenario ||
      !launchSessionId ||
      launchProgress < 100
    ) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          openSession(
            launchingScenario,
            launchSessionId,
          );
        },
        250,
      );

    return () =>
      window.clearTimeout(
        timeout,
      );
  }, [
    launchProgress,
    launchSessionId,
    launchingScenario,
  ]);

  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (
    launchingScenario
  ) {
    return (
      <ScenarioLoadingScreen
        scenario={
          launchingScenario
        }
        progress={
          launchProgress
        }
      />
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <Box
      w="100%"
      minH="100vh"
      bg={BG}
      color={TEXT}
      px={{
        base: "16px",
        md: "22px",
        xl: "28px",
      }}
      pt="22px"
      pb="48px"
    >
      <Box
        w="100%"
        maxW="1540px"
        mx="auto"
      >
        {/* =================================
            PAGE TITLE
        ================================= */}

        <Box mb="18px">
          <Text
            fontSize={{
              base: "25px",
              md: "30px",
            }}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={TEXT}
          >
            과거 시나리오
          </Text>

          <Text
            mt="5px"
            fontSize="13px"
            lineHeight="1.6"
            color={MUTED}
          >
            역사적인 경제 사건
            속으로 돌아가 당시
            시장에서 투자 판단을
            경험해보세요.
          </Text>
        </Box>

        {/* =================================
            FILTERS
        ================================= */}

        <Flex
          mb="17px"
          gap="10px"
          align={{
            base: "stretch",
            md: "center",
          }}
          direction={{
            base: "column",
            md: "row",
          }}
        >
          <HStack
            spacing="7px"
            flexWrap="wrap"
          >
            {/* 전체 */}

            <Button
              h="35px"
              px="15px"
              variant="outline"
              borderColor={
                selectedYear ===
                "전체"
                  ? ORANGE
                  : BORDER
              }
              bg={
                selectedYear ===
                "전체"
                  ? ORANGE_SOFT
                  : WHITE
              }
              color={
                selectedYear ===
                "전체"
                  ? ORANGE
                  : MUTED
              }
              borderRadius="7px"
              fontSize="12px"
              fontWeight="800"
              onClick={() =>
                setSelectedYear(
                  "전체",
                )
              }
            >
              전체
            </Button>

            {/* 연도 */}

            {years.map(
              (year) => (
                <Button
                  key={year}
                  h="35px"
                  px="15px"
                  variant="outline"
                  borderColor={
                    selectedYear ===
                    year
                      ? ORANGE
                      : BORDER
                  }
                  bg={
                    selectedYear ===
                    year
                      ? ORANGE_SOFT
                      : WHITE
                  }
                  color={
                    selectedYear ===
                    year
                      ? ORANGE
                      : MUTED
                  }
                  borderRadius="7px"
                  fontSize="12px"
                  fontWeight="800"
                  onClick={() =>
                    setSelectedYear(
                      year,
                    )
                  }
                >
                  {year}년
                </Button>
              ),
            )}
          </HStack>

          <Spacer />

          {/* 난이도 */}

          <Select
            w={{
              base: "100%",
              md: "150px",
            }}
            h="36px"
            value={
              selectedDifficulty
            }
            bg={WHITE}
            borderColor={BORDER}
            borderRadius="7px"
            fontSize="12px"
            fontWeight="700"
            onChange={(
              event,
            ) =>
              setSelectedDifficulty(
                event.target
                  .value,
              )
            }
          >
            <option value="전체">
              난이도 전체
            </option>

            <option value="쉬움">
              쉬움
            </option>

            <option value="보통">
              보통
            </option>

            <option value="어려움">
              어려움
            </option>
          </Select>
        </Flex>

        {/* =================================
            MAIN CONTENT
        ================================= */}

        <Grid
          templateColumns={{
            base: "1fr",

            xl:
              "minmax(0, 1fr) 390px",
          }}
          gap="16px"
          alignItems="stretch"
        >
          {/* ===============================
              SCENARIO MAP
          =============================== */}

          <GridItem minW="0">
            {isLoading ? (
              <Skeleton
                h="580px"
                borderRadius="12px"
              />
            ) : filteredScenarios
                .length ===
              0 ? (
              <Flex
                h="420px"
                align="center"
                justify="center"
                bg={WHITE}
                borderWidth="1px"
                borderColor={BORDER}
                borderRadius="12px"
              >
                <Text
                  fontSize="13px"
                  color={MUTED}
                >
                  조건에 맞는
                  시나리오가 없습니다.
                </Text>
              </Flex>
            ) : (
              <>
                {/* desktop */}

                <Box
                  display={{
                    base: "none",
                    xl: "block",
                  }}
                  position="relative"
                  h="580px"
                  bg="#FBF8F3"
                  borderWidth="1px"
                  borderColor="#EEE5DB"
                  borderRadius="12px"
                  overflow="hidden"
                >
                  <RaceTrackBackground />

                  {/* 중앙 */}

                  {selectedScenario && (
                    <CenterScenarioBubble
                      scenario={
                        selectedScenario
                      }
                      onClick={() =>
                        void handleStartScenario(
                          selectedScenario,
                        )
                      }
                    />
                  )}

                  {/* 주변 */}

                  {orbitScenarios.map(
                    (
                      scenario,
                      index,
                    ) => (
                      <OrbitScenarioBubble
                        key={
                          scenario.scenarioSlug
                        }
                        scenario={
                          scenario
                        }
                        index={
                          index
                        }
                        onSelect={() =>
                          setSelectedScenario(
                            scenario,
                          )
                        }
                      />
                    ),
                  )}
                </Box>

                {/* mobile */}

                <SimpleGrid
                  display={{
                    base: "grid",
                    xl: "none",
                  }}
                  columns={{
                    base: 1,
                    md: 2,
                  }}
                  spacing="9px"
                >
                  {filteredScenarios.map(
                    (scenario) => (
                      <MobileScenarioCard
                        key={
                          scenario.scenarioSlug
                        }
                        scenario={
                          scenario
                        }
                        selected={
                          selectedScenario
                            ?.scenarioSlug ===
                          scenario.scenarioSlug
                        }
                        onClick={() =>
                          setSelectedScenario(
                            scenario,
                          )
                        }
                      />
                    ),
                  )}
                </SimpleGrid>
              </>
            )}
          </GridItem>

          {/* ===============================
              DETAIL
          =============================== */}

          <GridItem minW="0">
            {selectedScenario ? (
              <ScenarioDetail
                scenario={
                  selectedScenario
                }
                isStarting={
                  isStartingScenario
                }
                onStart={() =>
                  void handleStartScenario(
                    selectedScenario,
                  )
                }
              />
            ) : (
              <Flex
                minH="580px"
                align="center"
                justify="center"
                bg={WHITE}
                borderWidth="1px"
                borderColor={BORDER}
                borderRadius="12px"
              >
                <Text
                  fontSize="13px"
                  color={MUTED}
                >
                  시나리오를
                  선택하세요.
                </Text>
              </Flex>
            )}
          </GridItem>
        </Grid>

        {/* =================================
            RECENT SCENARIOS
        ================================= */}

        <Box mt="23px">
          <Flex
            mb="11px"
            align="center"
          >
            <Text
              fontSize="18px"
              fontWeight="900"
              color={TEXT}
            >
              최근 플레이한
              시나리오
            </Text>

            {recentScenarios.length >
              0 && (
              <Text
                ml="9px"
                fontSize="10px"
                color={MUTED}
              >
                최근 진행 기록 기준
              </Text>
            )}
          </Flex>

          {recentScenarios.length >
          0 ? (
            <SimpleGrid
              columns={{
                base: 1,
                md: 2,
                xl: 3,
              }}
              spacing="10px"
            >
              {recentScenarios.map(
                (scenario) => (
                  <RecentScenarioCard
                    key={`recent-${scenario.scenarioSlug}`}
                    scenario={
                      scenario
                    }
                    onClick={() =>
                      void handleStartScenario(
                        scenario,
                      )
                    }
                  />
                ),
              )}
            </SimpleGrid>
          ) : (
            <Flex
              minH="100px"
              align="center"
              justify="center"
              bg={WHITE}
              borderWidth="1px"
              borderColor={BORDER}
              borderRadius="9px"
            >
              <Text
                fontSize="12px"
                color={MUTED}
              >
                아직 플레이한
                시나리오가 없습니다.
              </Text>
            </Flex>
          )}
        </Box>

        {/* =================================
            EMPTY
        ================================= */}

        {!isLoading &&
          scenarios.length ===
            0 && (
            <Box
              mt="12px"
              p="11px"
              bg="#FFF8F2"
              borderRadius="8px"
            >
              <Text
                fontSize="11px"
                color={MUTED}
              >
                등록된 시나리오가
                없습니다.
              </Text>
            </Box>
          )}
      </Box>
    </Box>
  );
}