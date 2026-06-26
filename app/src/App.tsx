import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Exchange from "./pages/Exchange";
import Scenario from "./pages/Scenario";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StockView from "./pages/StockView";
import NotFound from "./pages/NotFound";
import api from "./services/api.service";
import tokens from "./services/tokens.service";
import ScenarioChapter from "./pages/ScenarioChapter";
import ScenarioPlay from "./pages/ScenarioPlay";
import MyPage from "./pages/MyPage";
import SalaryCalculator from "./pages/SalaryCalculator";
import FinanceLearning from "./pages/FinanceLearning";
import Community from "./pages/Community";
import CommunityWrite from "./pages/CommunityWrite";
import CommunityPostDetail from "./pages/CommunityPostDetail";

interface OnboardingStatus {
	militaryProfileConfigured: boolean;
	salaryPlanConfigured: boolean;
	nextRoute: string;
}

function EntryRoute() {
	const [nextRoute, setNextRoute] =
		useState<string | null>(null);
	const [loadFailed, setLoadFailed] =
		useState(false);

	useEffect(() => {
		if (!tokens.isAuthenticated()) {
			setNextRoute("/login");
			return;
		}

		let cancelled = false;

		api
			.get<OnboardingStatus>(
				"/user/onboarding-status",
			)
			.then((response) => {
				if (cancelled) {
					return;
				}

				setNextRoute(
					response.data
						.militaryProfileConfigured
						? "/salary"
						: "/mypage",
				);
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				if (
					error?.response?.status === 401
				) {
					tokens.clearToken();
					setNextRoute("/login");
					return;
				}

				setLoadFailed(true);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	if (loadFailed) {
		return (
			<div
				style={{
					padding: "48px 24px",
					textAlign: "center",
				}}
			>
				초기 설정 상태를 확인하지 못했습니다.
				<br />
				페이지를 새로고침해 주세요.
			</div>
		);
	}

	if (!nextRoute) {
		return (
			<div
				style={{
					padding: "48px 24px",
					textAlign: "center",
				}}
			>
				초기 설정 상태를 확인하고 있습니다.
			</div>
		);
	}

	return (
		<Navigate
			to={nextRoute}
			replace
		/>
	);
}

function App() {
	return (
		<>
			<Navbar />

			<Routes>
				<Route
					path="/"
					element={<EntryRoute />}
				/>

				<Route path="/exchange" element={<Exchange />} />
				{/* 해커톤 버전에서는 사용하지 않음
				<Route path="/scenario" element={<Scenario />} />
				<Route path="/scenario/chapter/:chapterId" element={<ScenarioChapter />} />
				<Route path="/scenario/play/:scenarioId" element={<ScenarioPlay />} />
				*/}

				<Route path="/stocks/:symbol" element={<StockView />} />

				<Route path="/login" element={<Login />} />
				<Route path="/signup" element={<Signup />} />
				<Route path="/community" element={<Community />} />
				<Route path="/community/write" element={<CommunityWrite />} />
				<Route
					path="/community/:postId"
					element={<CommunityPostDetail />}
				/>

				<Route path="*" element={<NotFound />} />
				<Route path="/mypage" element={<MyPage />} />
				<Route path="/salary" element={<SalaryCalculator />} />

				<Route
					path="/salary-planner"
					element={
						<SalaryCalculator />
					}
				/>

				<Route
					path="/learn"
					element={
						<FinanceLearning />
					}
				/>

				<Route
					path="/learning"
					element={
						<FinanceLearning />
					}
				/>

				<Route
					path="/finance-learning"
					element={
						<FinanceLearning />
					}
				/>

				<Route
					path="/dictionary"
					element={
						<FinanceLearning />
					}
				/>

				<Route
					path="/quiz"
					element={
						<FinanceLearning />
					}
				/>

				<Route
					path="*"
					element={<NotFound />}
				/>
			</Routes>
		</>
	);
}

export default App;
