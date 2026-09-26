import { Badge, Box, Flex, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { LearningPatternChange, ScenarioLearningProgress } from "../../services/scenario.service";

const METRIC_LABELS: Record<string, string> = {
  M1: "핵심 요인 식별", M2: "정보 해석", M3: "위험 인식", M4: "행동 근거 합리성", M5: "논리 일관성",
};

function PatternList({ title, patterns, color }: { title: string; patterns: LearningPatternChange[]; color: string }) {
  if (!patterns.length) return null;
  return (
    <Box>
      <Text fontSize="12px" fontWeight="800" color={color}>{title}</Text>
      <Stack mt="7px" spacing="8px">
        {patterns.map((pattern) => (
          <Box key={pattern.pattern_code}>
            <Text fontSize="12px" fontWeight="700">{pattern.label} · {pattern.previous_occurrence_count} → {pattern.current_occurrence_count}회</Text>
            <Text mt="2px" fontSize="11px" color="app.subtleText">
              이전 TURN {pattern.previous_evidence_turns?.join(", ") || "없음"} / 이번 TURN {pattern.current_evidence_turns?.join(", ") || "없음"}
            </Text>
            {pattern.recommendation && <Text mt="3px" fontSize="11px" color="app.subtleText">{pattern.recommendation}</Text>}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default function LearningComparison({ progress }: { progress: ScenarioLearningProgress }) {
  const comparable = progress.status === "COMPARABLE";
  const delta = progress.score_delta_pct_points;
  return (
    <Box p="15px" bg="#FFF8F2" borderWidth="1px" borderColor="app.borderSoft" borderRadius="10px">
      <Flex align="center" gap="8px" flexWrap="wrap">
        <Text fontSize="13px" fontWeight="900">같은 시나리오 재도전 비교</Text>
        <Badge colorScheme="orange">{progress.attempt_no}번째 학습</Badge>
        {comparable && typeof delta === "number" && (
          <Badge colorScheme={delta > 0 ? "green" : delta < 0 ? "red" : "gray"}>
            이전 대비 {delta > 0 ? "+" : ""}{delta.toFixed(1)}%p
          </Badge>
        )}
      </Flex>
      <Text mt="8px" fontSize="12px" lineHeight="1.7" color="app.subtleText">{progress.summary}</Text>
      {comparable && (
        <>
          <SimpleGrid mt="12px" columns={{ base: 1, md: 2 }} spacing="15px">
            <PatternList title="다시 나타난 실수" patterns={progress.repeated_patterns ?? []} color="#B94C40" />
            <PatternList title="발생 횟수가 줄어든 실수" patterns={progress.improved_patterns ?? []} color="#33754C" />
            <PatternList title="이번에 새로 확인한 실수" patterns={progress.new_patterns ?? []} color="#956220" />
          </SimpleGrid>
          {(progress.metric_changes ?? []).length > 0 && (
            <Flex mt="12px" gap="6px" flexWrap="wrap">
              {progress.metric_changes.map((metric) => (
                <Badge key={metric.metric} variant="subtle" colorScheme={metric.delta > 0 ? "green" : metric.delta < 0 ? "red" : "gray"}>
                  {METRIC_LABELS[metric.metric] ?? metric.metric} {metric.previous_score.toFixed(1)} → {metric.current_score.toFixed(1)} / 5
                </Badge>
              ))}
            </Flex>
          )}
          <Text mt="10px" fontSize="10px" lineHeight="1.6" color="app.muted">
            같은 평가 기준의 직전 학습과 비교합니다. 횟수가 줄어도 남아 있는 실수는 두 목록에 함께 표시됩니다. 기록에서 사라진 실수도 실제 개선 여부는 다음 학습에서 다시 확인합니다.
          </Text>
        </>
      )}
    </Box>
  );
}
