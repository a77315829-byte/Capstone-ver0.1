import LegalLinks from "../components/LegalLinks";
import { useAuthConfig } from "../hooks/useAuthConfig";
import {
	Flex,
	Box,
	FormControl,
	FormLabel,
	Input,
	Stack,
	Button,
	Heading,
	Text,
	InputGroup,
	InputRightElement,
	Link,
	HStack,
	useToast,
} from "@chakra-ui/react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import accounts from "../services/accounts.service";
import tokens from "../services/tokens.service";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { useReducer, useState } from "react";

export default function Login() {
	const toast = useToast();
	const navigate = useNavigate();
 const { config, error: configError } = useAuthConfig();
 const [submitting, setSubmitting] = useState(false);

	const turnstileRef = useRef<TurnstileInstance>(null);

	useEffect(() => {
		if (tokens.isAuthenticated()) {
			navigate("/");
		}
	}, [navigate]);
	useLayoutEffect(() => {
		return () => {
			turnstileRef.current?.remove();
		};
	}, []);

	const [loginData, setLoginData] = useReducer(
		(state: any, newState: any) => ({ ...state, ...newState }),
		{ username: "", password: "", showPassword: false },
	);

	const handleSubmit = async (e: { preventDefault: () => void }) => {
		e.preventDefault();
        if (submitting || !config || configError) return;
        setSubmitting(true);
		// Call login function from auth.js
		accounts
			.login(
				loginData.username,
				loginData.password,
				turnstileRef.current?.getResponse()!,
			)
			.then((res) => {
				// Show alert with status of login attempt
				if (res === "success") {
					toast({
						title: "로그인되었습니다.",
						status: "success",
						isClosable: true,
					});
					navigate("/");
				} else {
					toast({
						title: `${res}`,
						status: "error",
						isClosable: true,
					});
				}
			})
			.catch((err) => {
				toast({
					title: `${err}`,
					status: "error",
					isClosable: true,
				});
			}).finally(() => { setSubmitting(false); turnstileRef.current?.reset(); });
	};

	return (
		<Flex align={"center"} justify={"center"}>
			<Stack spacing={8} mx={"auto"} maxW={"lg"} px={{ base: 0, md: 6 }}>
				<Stack align={"center"}>
					<Heading fontSize={"4xl"} textAlign="center">
						로그인
					</Heading>
					<HStack spacing="1">
						<Text>Or</Text>
						<Link as={RouterLink} to="/signup" fontWeight="500">
							create an account
						</Link>
					</HStack>
				</Stack>
				<Box rounded={"lg"} boxShadow={"lg"} p={8} pt={{ base: 4, md: 8 }}>
					<form onSubmit={handleSubmit}>
						<Stack spacing={4}>
							<FormControl id="username" isRequired>
								<FormLabel>아이디</FormLabel>
								<Input
									type="text"
                                    autoComplete="username"
                                    minLength={1}
                                    maxLength={40}
									onChange={(e) =>
										setLoginData({
											username: e.target.value,
										})
									}
								/>
							</FormControl>
							<FormControl id="password" isRequired>
								<FormLabel>비밀번호</FormLabel>
								<InputGroup>
									<Input
										type={loginData.showPassword ? "text" : "password"}
                                        autoComplete="current-password"

                                        maxLength={72}
										onChange={(e) =>
											setLoginData({
												password: e.target.value,
											})
										}
									/>
									<InputRightElement h={"full"}>
										<Button
											variant={"ghost"}
                                            type="button"
                                            aria-label={loginData.showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                                            aria-pressed={loginData.showPassword}
											onClick={() =>
												setLoginData({
													showPassword: !loginData.showPassword,
												})
											}
										>
											{loginData.showPassword ? <ViewIcon /> : <ViewOffIcon />}
										</Button>
									</InputRightElement>
								</InputGroup>
							</FormControl>
							<Stack spacing={10} alignItems="center">
								{/* <Stack
                  direction={{ base: "column", sm: "row" }}
                  align={"start"}
                  justify={"space-between"}
                >
                  <Checkbox
                    onChange={(e) =>
                      setLoginData({ rememberMe: e.target.checked })
                    }
                  >
                    Remember me
                  </Checkbox>
                  <Link to="/forgot-password">
                    <Text>Forgot password?</Text>
                  </Link>
                </Stack> */}
								{config?.captchaEnabled && <Turnstile
									ref={turnstileRef}
									siteKey={config.captchaSiteKey}
								/>}

								<Button type="submit" isLoading={submitting} isDisabled={!config || !!configError}>
									로그인
								</Button>
							</Stack>
						</Stack>
					</form>
                    {configError && <Text role="alert" mt="3" fontSize="sm">{configError}</Text>}
                    <LegalLinks />
				</Box>
			</Stack>
		</Flex>
	);
}
