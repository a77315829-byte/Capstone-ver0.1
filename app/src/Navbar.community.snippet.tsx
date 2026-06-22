// 현재 Navbar 버튼 구조에 맞춰 다음 링크를 추가하세요.
<Button
	as={RouterLink}
	to="/community"
	size="sm"
	variant={
		location.pathname.startsWith("/community")
			? "solid"
			: "ghost"
	}
	colorScheme="pink"
>
	커뮤니티
</Button>
