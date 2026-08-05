import React, {
	useEffect,
	useState,
} from "react";
import {
	ChevronDownIcon,
	UnlockIcon,
} from "@chakra-ui/icons";
import {
	Avatar,
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

const DEFAULT_PROFILE_IMAGE =
	"/default-ant-profile.png";

const getSavedProfileImage = (): string => {
	try {
		return (
			localStorage
				.getItem(
					"profileImageUrl",
				)
				?.trim() ||
			DEFAULT_PROFILE_IMAGE
		);
	} catch {
		return DEFAULT_PROFILE_IMAGE;
	}
};

export default function AccountMenu() {
	const location = useLocation();
	const navigate = useNavigate();

	const [username, setUsername] =
		useState<string | null>(
			tokens.getUsername(),
		);

	const [
		profileImage,
		setProfileImage,
	] = useState<string>(
		getSavedProfileImage(),
	);

	useEffect(() => {
		setUsername(
			tokens.getUsername(),
		);
		setProfileImage(
			getSavedProfileImage(),
		);
	}, [location.pathname]);

	const handleLogout = () => {
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
				variant="ghost"
				rightIcon={
					<ChevronDownIcon />
				}
				leftIcon={
					<Avatar
						size="sm"
						name={username}
						src={
							profileImage
						}
						bg="#FFF1D6"
						borderWidth="1px"
						borderColor="app.borderSoft"
					/>
				}
				px="8px"
				h="46px"
				fontWeight="800"
				color="app.text"
				_hover={{
					bg: "#FFF4EA",
				}}
			>
				{username}
			</MenuButton>

			<MenuList
				minW="150px"
				borderColor="app.borderSoft"
			>
				<MenuItem
					icon={
						<UnlockIcon />
					}
					onClick={
						handleLogout
					}
				>
					로그아웃
				</MenuItem>
			</MenuList>
		</Menu>
	);
}
