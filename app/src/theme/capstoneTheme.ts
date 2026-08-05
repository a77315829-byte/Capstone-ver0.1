import {
	extendTheme,
	type ThemeConfig,
	withDefaultColorScheme,
} from "@chakra-ui/react";

const config: ThemeConfig = {
	initialColorMode: "light",
	useSystemColorMode: false,
};

const capstoneTheme = extendTheme(
	withDefaultColorScheme({
		colorScheme: "brand",
	}),
	{
		config,

		colors: {
			brand: {
				50: "#FFF4EC",
				100: "#FFE4D2",
				200: "#FFC7A1",
				300: "#FFA66D",
				400: "#FF843E",
				500: "#F66B24",
				600: "#DE5317",
				700: "#B84012",
				800: "#913414",
				900: "#742C16",
			},

			app: {
				background: "#FDFAF4",
				sidebar: "#FBF7EE",
				surface: "#FFFFFF",
				softSurface: "#FBF7EE",
				hover: "#F8F1E7",
				border: "#E5D1B8",
				borderSoft: "#EFE2D2",
				text: "#171717",
				subtleText: "#56514B",
				muted: "#8A8178",
				positive: "#F05A2A",
				negative: "#1F53E7",
				success: "#29A85A",
			},
		},

		fonts: {
			heading: "'Pretendard', 'SUIT', sans-serif",
			body: "'Pretendard', 'SUIT', sans-serif",
		},

		styles: {
			global: {
				"html, body, #root": {
					minH: "100%",
					fontFamily: "'Pretendard', 'SUIT', sans-serif",
				},
				body: {
					bg: "app.background",
					color: "app.text",
					overflowY: "scroll",
				},
				"*": {
					boxSizing: "border-box",
				},
				"::selection": {
					bg: "brand.100",
					color: "brand.900",
				},
			},
		},

		radii: {
			panel: "10px",
		},

		shadows: {
			panel: "0 2px 8px rgba(82, 58, 35, 0.05)",
		},

		components: {
			Button: {
				baseStyle: {
					fontWeight: "700",
					borderRadius: "8px",
				},
			},

			Card: {
				baseStyle: {
					container: {
						bg: "app.surface",
						borderWidth: "1px",
						borderColor: "app.border",
						borderRadius: "10px",
						boxShadow: "none",
					},
				},
			},

			Badge: {
				baseStyle: {
					borderRadius: "999px",
					fontWeight: "700",
				},
			},

			Input: {
				variants: {
					outline: {
						field: {
							bg: "app.surface",
							borderColor: "app.border",
							borderRadius: "8px",
							_hover: {
								borderColor: "brand.300",
							},
							_focusVisible: {
								borderColor: "brand.500",
								boxShadow: "0 0 0 1px #F66B24",
							},
						},
					},
				},
			},

			Select: {
				variants: {
					outline: {
						field: {
							bg: "app.surface",
							borderColor: "app.border",
							borderRadius: "8px",
							_hover: {
								borderColor: "brand.300",
							},
							_focusVisible: {
								borderColor: "brand.500",
								boxShadow: "0 0 0 1px #F66B24",
							},
						},
					},
				},
			},

			Textarea: {
				variants: {
					outline: {
						bg: "app.surface",
						borderColor: "app.border",
						borderRadius: "8px",
						_hover: {
							borderColor: "brand.300",
						},
						_focusVisible: {
							borderColor: "brand.500",
							boxShadow: "0 0 0 1px #F66B24",
						},
					},
				},
			},

			Table: {
				baseStyle: {
					th: {
						fontWeight: "600",
						color: "app.muted",
						textTransform: "none",
						letterSpacing: "normal",
					},
				},
			},
		},
	},
);

export default capstoneTheme;
