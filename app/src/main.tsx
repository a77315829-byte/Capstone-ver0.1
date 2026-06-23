import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import {
	ChakraProvider,
	extendTheme,
	withDefaultColorScheme,
} from "@chakra-ui/react";

import {
	BrowserRouter,
} from "react-router-dom";

/*
 * 앱 전체 군 테마를 고정하려면 "army"를 사용합니다.
 *
 * 기존 사용자 색상 설정을 계속 사용할 경우:
 * const accentColor =
 * 	localStorage.getItem("accentColor") || "army";
 */
const accentColor = "army";

const customTheme = extendTheme(
	withDefaultColorScheme({
		colorScheme: accentColor,
	}),
	{
		config: {
			initialColorMode: "light",
			useSystemColorMode: false,
		},

		colors: {
			army: {
				50: "#F4F5EE",
				100: "#E5E8D9",
				200: "#CDD3B8",
				300: "#ADB986",
				400: "#899D5E",
				500: "#697F43",
				600: "#536736",
				700: "#404F2B",
				800: "#303C23",
				900: "#222B19",
			},

			khaki: {
				50: "#FAF8EF",
				100: "#F1ECD8",
				200: "#E4D9B7",
				300: "#D2C18E",
				400: "#B8A466",
				500: "#9C874B",
				600: "#806D3D",
				700: "#665632",
				800: "#4D4229",
				900: "#37301F",
			},

			field: {
				50: "#F2F4F1",
				100: "#DDE3DB",
				200: "#BDC8B9",
				300: "#98AA91",
				400: "#728A6B",
				500: "#556F4E",
				600: "#43583E",
				700: "#344431",
				800: "#293527",
				900: "#1D261C",
			},

			signal: {
				50: "#FFF7E8",
				100: "#FCE9BF",
				200: "#F7D78B",
				300: "#F0BE4E",
				400: "#E4A52B",
				500: "#C98A1D",
				600: "#A66D16",
				700: "#835313",
				800: "#633F15",
				900: "#493014",
			},
		},

		styles: {
			global: (props: {
				colorMode: string;
			}) => ({
				"html, body, #root": {
					minHeight: "100%",
					fontFamily:
						"'SUIT', 'Pretendard', sans-serif",
				},

				body: {
					backgroundColor:
						props.colorMode ===
						"dark"
							? "field.900"
							: "#F2F1E9",

					color:
						props.colorMode ===
						"dark"
							? "gray.100"
							: "#20271E",
				},

				"::selection": {
					backgroundColor:
						"army.200",
					color: "army.900",
				},
			}),
		},

		fonts: {
			heading:
				"'SUIT', 'Pretendard', sans-serif",
			body:
				"'SUIT', 'Pretendard', sans-serif",
		},

		components: {
			Spinner: {
				baseStyle: {
					color:
						`${accentColor}.500`,
					borderWidth: "3px",
				},

				defaultProps: {
					size: "xl",
				},
			},

			Link: {
				baseStyle: {
					color:
						`${accentColor}.600`,
				},
			},

			Button: {
				baseStyle: {
					fontWeight: "800",
					borderRadius: "10px",
				},
			},

			Card: {
				baseStyle: {
					container: {
						backgroundColor:
							"#FFFEFA",
						borderColor:
							"army.200",
					},
				},
			},

			Input: {
				variants: {
					outline: {
						field: {
							backgroundColor:
								"white",
							borderColor:
								"army.200",

							_hover: {
								borderColor:
									"army.400",
							},

							_focusVisible: {
								borderColor:
									"army.500",
								boxShadow:
									"0 0 0 1px #697F43",
							},
						},
					},
				},
			},

			Select: {
				variants: {
					outline: {
						field: {
							backgroundColor:
								"white",
							borderColor:
								"army.200",

							_hover: {
								borderColor:
									"army.400",
							},

							_focusVisible: {
								borderColor:
									"army.500",
								boxShadow:
									"0 0 0 1px #697F43",
							},
						},
					},
				},
			},
		},
	},
);

ReactDOM.createRoot(
	document.getElementById(
		"root",
	)!,
).render(
	<React.StrictMode>
		<BrowserRouter>
			<ChakraProvider
				theme={
					customTheme
				}
			>
				<App />
			</ChakraProvider>
		</BrowserRouter>
	</React.StrictMode>,
);