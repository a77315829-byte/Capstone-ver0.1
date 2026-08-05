import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import capstoneTheme from "./theme/capstoneTheme";

ReactDOM.createRoot(
	document.getElementById("root")!,
).render(
	<React.StrictMode>
		<BrowserRouter>
			<ChakraProvider theme={capstoneTheme}>
				<App />
			</ChakraProvider>
		</BrowserRouter>
	</React.StrictMode>,
);
