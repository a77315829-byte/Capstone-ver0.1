import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Exchange from "./pages/Exchange";
import Scenario from "./pages/Scenario";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StockView from "./pages/StockView";
import NotFound from "./pages/NotFound";
import React from "react";
import ScenarioChapter from "./pages/ScenarioChapter";
import ScenarioPlay from "./pages/ScenarioPlay";
import MyPage from "./pages/MyPage";
function App() {
	return (
		<>
			<Navbar />

			<Routes>
				<Route path="/" element={<Navigate to="/exchange" replace />} />

				<Route path="/exchange" element={<Exchange />} />
				<Route path="/scenario" element={<Scenario />} />
				<Route path="/scenario/chapter/:chapterId" element={<ScenarioChapter />} />
				<Route path="/scenario/play/:scenarioId" element={<ScenarioPlay />} />

				<Route path="/stocks/:symbol" element={<StockView />} />

				<Route path="/login" element={<Login />} />
				<Route path="/signup" element={<Signup />} />

				<Route path="*" element={<NotFound />} />
				<Route path="/mypage" element={<MyPage />} />
			</Routes>
		</>
	);
}

export default App;