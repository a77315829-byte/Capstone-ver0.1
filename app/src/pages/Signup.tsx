import LegalLinks from "../components/LegalLinks";
import { useAuthConfig } from "../hooks/useAuthConfig";
import {
	Flex,
	Box,
	FormControl,
	FormLabel,
	Input,
	InputGroup,
	HStack,
	InputRightElement,
	Stack,
	Button,
	Heading,
	Text,
	Link,
	useToast,
} from "@chakra-ui/react";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import accounts from "../services/accounts.service";
import tokens from "../services/tokens.service";

export default function Signup() {
	const toast = useToast();
	const navigate = useNavigate();
 const { config, error: configError } = useAuthConfig();
 const [submitting, setSubmitting] = useState(false);

	const turnstileRef = useRef<TurnstileInstance>(null);

	useEffect(() => {
		if (tokens.isAuthenticated()) {
			// Redirect to home if already authenticated
			navigate("/");
		}
	});

	useLayoutEffect(() => {
		return () => {
			turnstileRef.current?.remove();
		};
	}, []);

	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	const handleSubmit = async (e: { preventDefault: () => void }) => {
		e.preventDefault();
        if (submitting || !config || configError) return;
        setSubmitting(true);
		// Call signup function from auth.js
		accounts
			.signup(username, password, turnstileRef.current?.getResponse()!)
			.then((res) => {
				// Show alert with status of signup attempt
				if (res === "success") {
					toast({
						title: "회원가입이 완료되었습니다.",
						status: "success",
						isClosable: true,
					});
					navigate("/login");
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
						회원가입
					</Heading>
				</Stack>
				<Box rounded={"lg"} boxShadow={"lg"} p={8} pt={{ base: 4, md: 8 }}>
					<form onSubmit={handleSubmit}>
						<Stack spacing={4}>
							<FormControl id="username" isRequired>
								<FormLabel>아이디</FormLabel>
								<Input
									type="text"
                                    autoComplete="username"
                                    minLength={3}
                                    maxLength={40}
									onChange={(e) => setUsername(e.target.value)}
								/>
							</FormControl>
							<FormControl id="password" isRequired>
								<FormLabel>비밀번호</FormLabel>
								<InputGroup>
									<Input
										type={showPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        minLength={8}
                                        maxLength={72}
										onChange={(e) => setPassword(e.target.value)}
									/>
									<InputRightElement h={"full"}>
										<Button
											variant={"ghost"}
                                            type="button"
                                            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                                            aria-pressed={showPassword}
											onClick={() =>
												setShowPassword((showPassword) => !showPassword)
											}
										>
											{showPassword ? <ViewIcon /> : <ViewOffIcon />}
										</Button>
									</InputRightElement>
								</InputGroup>
							</FormControl>
							<Stack spacing={5} pt={2}>
								{config?.captchaEnabled && <Turnstile
									ref={turnstileRef}
									siteKey={config.captchaSiteKey}
								/>}
								<Button
									loadingText="가입 중"
                                    isLoading={submitting}
                                    isDisabled={!config || !!configError}
									size="lg"
									type="submit"
								>
									회원가입
								</Button>
							</Stack>
							<HStack pt={2} fontWeight="500">
								<Text>Already a user?</Text>
								<Link as={RouterLink} to="/login">
									Login
								</Link>
							</HStack>
						</Stack>
					</form>
                    {configError && <Text role="alert" mt="3" fontSize="sm">{configError}</Text>}
                    <LegalLinks />
				</Box>
			</Stack>
		</Flex>
	);
}
