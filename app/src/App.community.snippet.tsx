// App.tsx import에 추가
import Community from "./pages/Community";
import CommunityWrite from "./pages/CommunityWrite";
import CommunityPostDetail from "./pages/CommunityPostDetail";

// <Routes> 내부에 추가
<Route
	path="/community"
	element={<Community />}
/>

<Route
	path="/community/write"
	element={<CommunityWrite />}
/>

<Route
	path="/community/:postId"
	element={<CommunityPostDetail />}
/>
