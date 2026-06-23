import {
	extendTheme,
	type ThemeConfig,
	withDefaultColorScheme,
} from "@chakra-ui/react";

const config: ThemeConfig = {
	initialColorMode: "light",
	useSystemColorMode: false,
};

const militaryTheme =
	extendTheme(
		withDefaultColorScheme({
			colorScheme: "army",
		}),
		{
			config,

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

			fonts: {
				heading:
					"'SUIT', 'Pretendard', sans-serif",
				body:
					"'SUIT', 'Pretendard', sans-serif",
			},

			styles: {
				global: {
					"html, body, #root": {
						minH: "100%",
						fontFamily:
							"'SUIT', 'Pretendard', sans-serif",
					},

					body: {
						bg: "#F2F1E9",
						color: "#20271E",
					},

					"::selection": {
						bg: "army.200",
						color: "army.900",
					},
				},
			},

			radii: {
				panel: "14px",
			},

			shadows: {
				panel:
					"0 10px 28px rgba(40, 49, 31, 0.08)",
			},

			components: {
				Button: {
					baseStyle: {
						fontWeight: "800",
						borderRadius: "10px",
					},

					variants: {
						solid: {
							boxShadow:
								"0 3px 8px rgba(48, 60, 35, 0.12)",
						},

						outline: {
							bg: "white",
							borderColor:
								"army.300",
							color:
								"army.800",

							_hover: {
								bg:
									"army.50",
							},
						},
					},
				},

				Card: {
					baseStyle: {
						container: {
							borderColor:
								"rgba(83, 103, 54, 0.18)",
							bg: "#FFFEFA",
						},
					},
				},

				Badge: {
					baseStyle: {
						borderRadius:
							"999px",
						fontWeight: "900",
						letterSpacing:
							"0.01em",
					},
				},

				Input: {
					variants: {
						outline: {
							field: {
								bg: "white",
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
								bg: "white",
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

				NumberInput: {
					variants: {
						outline: {
							field: {
								bg: "white",
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

				Tabs: {
					variants: {
						enclosed: {
							tab: {
								fontWeight:
									"800",

								_selected: {
									color:
										"army.800",
									borderColor:
										"army.300",
									borderBottomColor:
										"white",
									bg:
										"white",
								},
							},
						},
					},
				},
			},
		},
	);

export default militaryTheme;
