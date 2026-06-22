import React, {
	useEffect,
	useState,
} from "react";
import {
	ChevronDownIcon,
	UnlockIcon,
} from "@chakra-ui/icons";
import {
	Button,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
} from "@chakra-ui/react";
import {
	Link as RouterLink,
	useLocation,
	useNavigate,
} from "react-router-dom";

import tokens from "../services/tokens.service";

export default function AccountMenu() {
	const location = useLocation();
	const navigate = useNavigate();

	const [username, setUsername] =
		useState<string | null>(
			tokens.getUsername(),
		);

	/*
	 * 로그인 성공 후 다른 페이지로 이동하면
	 * localStorage의 username을 다시 읽습니다.
	 */
	useEffect(() => {
		setUsername(tokens.getUsername());
	}, [location.pathname]);

	const handleLogout = () => {
		/*
		 * 먼저 저장된 JWT와 username을 삭제한 뒤
		 * 로그인 화면으로 이동합니다.
		 */
		tokens.clearToken();
		setUsername(null);

		navigate("/login", {
			replace: true,
		});
	};

	if (!username) {
		return (
			<Button
				as={RouterLink}
				to="/login"
				size="sm"
				variant="outline"
			>
				로그인
			</Button>
		);
	}

	return (
		<Menu>
			<MenuButton
				as={Button}
				size="sm"
				variant="outline"
				rightIcon={<ChevronDownIcon />}
			>
				{username}
			</MenuButton>

			<MenuList minW="150px">
				<MenuItem
					icon={<UnlockIcon />}
					onClick={handleLogout}
				>
					로그아웃
				</MenuItem>
			</MenuList>
		</Menu>
	);
}