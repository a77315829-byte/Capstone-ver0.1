import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Box, Button, Card, CardBody, Flex, Heading, Select, Skeleton, Stack, Text } from "@chakra-ui/react";
import scenarioService, { type ScenarioEvaluationSummary, type ScenarioUserProgress } from "../../services/scenario.service";
import FinalResultModal, { type FinalEvaluation } from "../scenario/FinalResultModal";
import LearningComparison from "../scenario/LearningComparison";

export default function ScenarioLearningHistory({ userId, scenarioProgress, refreshKey }: {
  userId: string;
  scenarioProgress: ScenarioUserProgress | null;
  refreshKey?: number;
}) {
  const [history, setHistory] = useState<ScenarioEvaluationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const [detail, setDetail] = useState<FinalEvaluation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const loadRequest = useRef(0);
  const detailRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequest.current;
    setLoading(true);
    setError("");
    try {
      const result = await scenarioService.getEvaluations(userId);
      if (requestId === loadRequest.current) setHistory(Array.isArray(result) ? result : []);
    } catch {
      if (requestId === loadRequest.current) setError("학습 기록을 불러오지 못했습니다. 시나리오 서버 연결을 확인하고 다시 시도해주세요.");
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    return () => { loadRequest.current += 1; };
  }, [load, refreshKey]);
  useEffect(() => {
    setHistory([]);
    setDetail(null);
    setDetailError("");
    setLoadingDetail(null);
    return () => { detailRequest.current += 1; };
  }, [userId]);
  const scenarioIds = useMemo(() => [...new Set(history.map((item) => item.scenario_id))], [history]);
  const selectedScenario = scenarioIds.includes(scenarioId) ? scenarioId : scenarioIds[0] ?? "";
  const attempts = useMemo(() => history.filter((item) => item.scenario_id === selectedScenario)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at)), [history, selectedScenario]);
  const title = (id: string) => scenarioProgress?.items.find((item) => item.scenario_id === id)?.title ?? id;

  async function openDetail(evaluationId: string) {
    const requestId = ++detailRequest.current;
    setLoadingDetail(evaluationId);
    setDetailError("");
    try {
      const result = await scenarioService.getEvaluation(userId, evaluationId) as FinalEvaluation;
      if (requestId === detailRequest.current) setDetail(result);
    } catch {
      if (requestId === detailRequest.current) setDetailError("상세 평가를 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      if (requestId === detailRequest.current) setLoadingDetail(null);
    }
  }

  return (
    <Card mb="18px">
      <CardBody p={{ base: "18px", md: "22px" }}>
        <Flex gap="12px" align={{ base: "stretch", md: "center" }} direction={{ base: "column", md: "row" }} justify="space-between">
          <Box>
            <Heading size="sm">나의 학습 히스토리</Heading>
            <Text mt="7px" fontSize="12px" color="app.subtleText">같은 시나리오를 반복하며 판단 점수와 실수의 변화를 확인하세요.</Text>
          </Box>
          {scenarioIds.length > 0 && <Select aria-label="학습 기록 시나리오 선택" value={selectedScenario} maxW={{ md: "300px" }} size="sm"
            onChange={(event) => { setScenarioId(event.target.value); setVisibleCount(5); }}>
            {scenarioIds.map((id) => <option key={id} value={id}>{title(id)}</option>)}
          </Select>}
        </Flex>
        {loading ? <Skeleton mt="16px" h="120px" /> : error ? (
          <Box mt="16px"><Text fontSize="12px" role="alert">{error}</Text><Button mt="8px" size="sm" onClick={() => void load()}>다시 불러오기</Button></Box>
        ) : attempts.length === 0 ? (
          <Box mt="16px" p="18px" bg="brand.50" borderRadius="10px">
            <Text fontSize="13px" fontWeight="800">첫 학습을 완료하면 기록이 시작됩니다.</Text>
            <Text mt="5px" fontSize="12px" color="app.subtleText">한 번 완료하면 점수와 판단 근거를, 같은 시나리오를 다시 완료하면 반복 실수와 발전 내역을 볼 수 있습니다.</Text>
          </Box>
        ) : (
          <Stack mt="16px" spacing="12px">
            {attempts[0]?.learning_progress && <LearningComparison progress={attempts[0].learning_progress} />}
            <Text fontSize="11px" color="app.muted">점수 백분율 = 5점 만점 점수 ÷ 5 × 100. 투자 수익률이나 AI 정답률과는 별개의 학습 평가입니다.</Text>
            {attempts.slice(0, visibleCount).map((attempt) => {
              const score = attempt.overall_score;
              const percent = typeof score === "number" && Number.isFinite(score) ? Math.max(0, Math.min(100, score * 20)) : null;
              const completedAt = new Date(attempt.completed_at);
              return (
                <Box key={attempt.evaluation_id} p="14px" borderWidth="1px" borderColor="app.borderSoft" borderRadius="10px">
                  <Flex gap="10px" align="center" flexWrap="wrap">
                    <Badge colorScheme="orange">{attempt.learning_progress ? `${attempt.learning_progress.attempt_no}번째 학습` : "완료한 학습"}</Badge>
                    <Text fontSize="11px" color="app.muted">{Number.isNaN(completedAt.getTime()) ? attempt.completed_at : completedAt.toLocaleString("ko-KR")}</Text>
                    <Text ml="auto" fontSize="18px" fontWeight="900" color="brand.500">{percent === null ? "점수 없음" : `${percent.toFixed(1)}%`}</Text>
                    {percent !== null && <Text fontSize="11px" color="app.muted">({score?.toFixed(2)} / 5)</Text>}
                  </Flex>
                  {percent !== null && <Box mt="8px" h="5px" bg="#EEE8E2" borderRadius="full"><Box h="5px" w={`${percent}%`} bg="brand.500" borderRadius="full" /></Box>}
                  <Text mt="9px" fontSize="12px" lineHeight="1.7" color="app.subtleText">{attempt.summary || "저장된 종합 평가에서 판단 근거를 확인할 수 있습니다."}</Text>
                  {attempt.learning_progress && <Text mt="5px" fontSize="11px" color="app.subtleText">{attempt.learning_progress.summary}</Text>}
                  <Flex mt="10px" align="center" gap="10px">
                    <Text fontSize="10px" color="app.muted">평가 기준: {attempt.evaluator_version || "기록 없음"}</Text>
                    <Button ml="auto" size="xs" variant="outline" isLoading={loadingDetail === attempt.evaluation_id} onClick={() => void openDetail(attempt.evaluation_id)}>판단 근거·해설 보기</Button>
                  </Flex>
                </Box>
              );
            })}
            {attempts.length > visibleCount && <Button size="sm" variant="ghost" onClick={() => setVisibleCount((count) => count + 5)}>이전 학습 더 보기 ({attempts.length - visibleCount}개)</Button>}
            {detailError && <Text fontSize="12px" color="red.600" role="alert">{detailError}</Text>}
          </Stack>
        )}
      </CardBody>
      <FinalResultModal isOpen={detail !== null} evaluation={detail} onClose={() => setDetail(null)} onGoMyPage={() => setDetail(null)} />
    </Card>
  );
}
