import { Box, Heading, Text, Stack, Link } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import LegalLinks from "../components/LegalLinks";
export default function Legal({ type }: { type: "privacy" | "terms" }) {
 const privacy = type === "privacy";
 return <Box as="main" maxW="800px" mx="auto" px="6" py="10"><Stack spacing="5">
  <Link as={RouterLink} to="/">서비스로 돌아가기</Link>
  <Heading as="h1" size="lg">{privacy ? "개인정보 처리방침" : "이용약관"} · 초안</Heading>
  <Text fontWeight="bold">ANTITUDE 캡스톤 전시용 검토 초안입니다. 최종 운영 방침과 동의 절차는 전시 전에 확정해야 합니다.</Text>
  <Text>작성일: 2026년 11월 16일 · 전시 예정일: 11월 18~19일</Text>
  {privacy ? <>
   <Heading as="h2" size="md">처리 목적과 항목</Heading>
   <Text>로그인과 학습 기록 관리를 위해 아이디, 해시 처리한 비밀번호, 관심 종목, 가상 계좌·거래 내역, 시나리오 답변·평가, 퀴즈 진행 기록을 처리합니다. 군 복무·월급 기능을 이용하면 입력한 복무 정보와 지출·저축 계획도 처리합니다. 실명, 실제 계좌번호, 타인의 개인정보는 입력하지 마세요.</Text>
   <Heading as="h2" size="md">저장과 공개 범위</Heading>
   <Text>회원·모의투자·시나리오 기록은 운영자가 설정한 MongoDB에 저장됩니다. 퀴즈 진행 기록은 브라우저에도 캐시됩니다. 로그인 토큰은 탭 세션에 저장되며 로그아웃 시 삭제됩니다. 게시글·댓글·공개 프로필과 순위는 해당 기능의 다른 이용자에게 보일 수 있습니다. 시장 반응 분석은 현재 결과를 별도 학습 이력으로 저장하지 않습니다.</Text>
   <Heading as="h2" size="md">AI 및 외부 서비스</Heading>
   <Text>설정에 따라 입력한 분석 내용·시나리오 답변이 로컬 Ollama 또는 외부 AI 제공자(OpenAI·Google)에게 전달될 수 있습니다. Turnstile을 사용하면 자동입력 방지 확인을 위해 Cloudflare와 통신합니다. MongoDB 호스팅 위치, 실제 사용 제공자와 전송 항목, 처리위탁·국외 이전 해당 여부는 운영 환경 확인 후 최종 방침에 기재해야 합니다.</Text>
   <Heading as="h2" size="md">보관 기간과 삭제</Heading>
   <Text>11월 18~19일은 전시 예정 기간입니다. 전시 종료 후 DB 및 백업의 구체적인 보관·파기 시점은 아직 확정되지 않았습니다. 현재 자동 파기 기능은 없으며, 담당자가 보관 기간과 삭제 절차를 확정해야 합니다.</Text>
   <Heading as="h2" size="md">열람·정정·삭제 문의</Heading>
   <Text>운영 주체: ANTITUDE · 문의: <Link href="tel:01077315829">010-7731-5829</Link>. 기록 열람·정정·삭제 및 처리 관련 문의를 접수합니다. 담당자는 계정 확인 후 DB·백업·브라우저 캐시의 처리 범위를 확인해야 합니다.</Text>
   <Heading as="h2" size="md">공용 PC 이용</Heading>
   <Text>체험 후 로그아웃하세요. 로그인 비밀번호는 다른 서비스와 다르게 설정하고 브라우저에 저장하지 마세요. 공용 PC에서 남은 퀴즈 캐시는 로그아웃할 때 지워집니다.</Text>
  </> : <>
   <Heading as="h2" size="md">서비스 목적</Heading>
   <Text>ANTITUDE는 금융·투자 판단을 연습하는 캡스톤 교육용 서비스입니다. 잔액과 주문은 가상이며 실제 주식 주문이나 금전 거래를 실행하지 않습니다.</Text>
   <Heading as="h2" size="md">분석 결과의 의미</Heading>
   <Text>AI 분석과 규칙 기반 대체 분석은 학습 참고 자료입니다. 화면의 확률·신뢰도·시장 압력은 실제 수익률이나 가격 예측 정확도를 보장하지 않습니다. 시세 지연, 외부 서비스 중단 또는 자료 부족으로 결과가 달라질 수 있습니다.</Text>
   <Heading as="h2" size="md">이용 원칙</Heading>
   <Text>본인의 계정만 사용하고, 타인의 개인정보·비밀번호·권리를 침해하는 자료를 입력하지 마세요. 다른 이용자의 기록에 접근하거나 서비스 운영을 방해해서는 안 됩니다. 게시 기능에는 공개 가능한 내용만 작성하세요.</Text>
   <Heading as="h2" size="md">전시 운영과 기록</Heading>
   <Text>전시는 2026년 11월 18~19일로 예정되어 있습니다. 운영 일정·기능과 전시 후 기록 보관 기간은 최종 안내에 따라 확정됩니다. 장애 또는 점검으로 일부 기능이 제한될 수 있습니다.</Text>
   <Heading as="h2" size="md">문의</Heading>
   <Text>ANTITUDE · <Link href="tel:01077315829">010-7731-5829</Link></Text>
  </>}
  <LegalLinks />
 </Stack></Box>;
}
