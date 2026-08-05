import { Box, useDisclosure } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";

import TopHeader from "../components/header/TopHeader";
import Sidebar from "../components/navigation/Sidebar";

export default function AppLayout() {
	const mobileNavigation = useDisclosure();

	return (
		<Box minH="100vh" bg="app.background">
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
					minW="0"
					w="100%"
					overflowX="hidden"
				>
					<Outlet />
				</Box>
			</Box>
		</Box>
	);
}
