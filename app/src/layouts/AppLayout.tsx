import LegalLinks from "../components/LegalLinks";
import { Box, useDisclosure } from "@chakra-ui/react";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";

import TopHeader from "../components/header/TopHeader";
import Sidebar from "../components/navigation/Sidebar";

export default function AppLayout() {
	const mobileNavigation = useDisclosure();
	const location = useLocation();
	useEffect(() => {
		if (window.matchMedia("(max-width: 47.99em)").matches) window.scrollTo(0, 0);
	}, [location.pathname, location.search]);

	return (
		<Box minH="100vh" bg="app.background">
			<Box as="a" href="#main-content" position="fixed" top="2" left="2" transform="translateY(-200%)" zIndex={2000} bg="white" p="3" _focus={{ transform: "translateY(0)" }}>본문으로 건너뛰기</Box>
            <Sidebar
				isOpen={mobileNavigation.isOpen}
				onClose={mobileNavigation.onClose}
			/>

			<Box
				ml={{ base: 0, "2xl": "246px" }}
				minW="0"
				minH="100vh"
			>
				<TopHeader onOpenNavigation={mobileNavigation.onOpen} />

				<Box
					as="main"
                    id="main-content"
                    tabIndex={-1}
					minW="0"
					w="100%"
					overflowX="hidden"
					pb={{ base: "64px", md: "0" }}
				>
					<Outlet />
                    <LegalLinks />
				</Box>
			</Box>
		</Box>
	);
}
