import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import AiJudgmentPage from "./pages/AiJudgment";
import tokens from "./services/tokens.service";

import Community from "./pages/Community";
import CommunityPostDetail from "./pages/CommunityPostDetail";
import CommunityWrite from "./pages/CommunityWrite";
import Exchange from "./pages/Exchange";
import FinanceLearning from "./pages/FinanceLearning";
import Login from "./pages/Login";
import MarketSimulator from "./pages/MarketSimulator";
import MyPage from "./pages/MyPage";
import RealtimeNews from "./pages/RealtimeNews";
import NotFound from "./pages/NotFound";
import SalaryCalculator from "./pages/SalaryCalculator";
import Scenario from "./pages/Scenario";
import ScenarioChapter from "./pages/ScenarioChapter";
import ScenarioPlay from "./pages/ScenarioPlay";
import Signup from "./pages/Signup";
import StockView from "./pages/StockView";

function EntryRoute() {
	return (
		<Navigate
			to={tokens.isAuthenticated() ? "/scenario" : "/login"}
			replace
		/>
	);
}

function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route path="/signup" element={<Signup />} />

			<Route element={<AppLayout />}>
				<Route path="/" element={<EntryRoute />} />

				<Route path="/mypage" element={<MyPage />} />

				<Route path="/scenario" element={<Scenario />} />
				<Route
					path="/scenario/chapter/:chapterId"
					element={<ScenarioChapter />}
				/>
				<Route
					path="/scenario/play/:scenarioId"
					element={<ScenarioPlay />}
				/>

				<Route path="/exchange" element={<Exchange />} />
				<Route path="/ai-judgment" element={<AiJudgmentPage />} />
				<Route path="/stocks/:symbol" element={<StockView />} />
				<Route path="/simulator" element={<MarketSimulator />} />
				<Route path="/news" element={<RealtimeNews />} />

				<Route path="/learn" element={<FinanceLearning />} />
				<Route path="/learning" element={<FinanceLearning />} />
				<Route path="/finance-learning" element={<FinanceLearning />} />
				<Route path="/dictionary" element={<FinanceLearning />} />
				<Route path="/quiz" element={<FinanceLearning />} />

				{/*
				 * 기존 군 해커톤 기능은 서버 및 DB 호환성 보존을 위해
				 * 라우트만 임시 유지합니다. 새 사이드바에는 노출하지 않습니다.
				 */}
				<Route path="/salary" element={<SalaryCalculator />} />
				<Route path="/salary-planner" element={<SalaryCalculator />} />
				<Route path="/community" element={<Community />} />
				<Route path="/community/write" element={<CommunityWrite />} />
				<Route
					path="/community/:postId"
					element={<CommunityPostDetail />}
				/>

				<Route path="*" element={<NotFound />} />
			</Route>
		</Routes>
	);
}

export default App;
