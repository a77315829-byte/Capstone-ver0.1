import React from "react";

import {
	Box,
	Button,
	Card,
	CardBody,
	Flex,
	Heading,
	HStack,
	Text,
} from "@chakra-ui/react";

import {
	ArrowForwardIcon,
} from "@chakra-ui/icons";

import {
	useNavigate,
} from "react-router-dom";

import financeTermsData from "../data/financeTerms.json";

import type {
	FinanceTerm,
} from "../types/learning.types";

const financeTerms =
	financeTermsData as FinanceTerm[];

const financeTermById =
	new Map(
		financeTerms.map(
			(term) => [
				term.id,
				term,
			],
		),
	);

interface RelatedFinancialTermsProps {
	title: string;
	description?: string;
	termIds: string[];
}

export default function RelatedFinancialTerms({
	title,
	description,
	termIds,
}: RelatedFinancialTermsProps) {
	const navigate =
		useNavigate();

	const terms =
		termIds
			.map(
				(termId) =>
					financeTermById.get(
						termId,
					),
			)
			.filter(
				(
					term,
				): term is FinanceTerm =>
					Boolean(term),
			);

	if (
		terms.length ===
		0
	) {
		return null;
	}

	return (
		<Card
			mb="5"
			borderWidth="1px"
			borderColor="army.200"
			borderRadius="16px"
			bg="#FFFEFA"
			boxShadow="sm"
		>
			<CardBody
				p={{
					base: "16px",
					md: "20px",
				}}
			>
				<Flex
					align={{
						base:
							"flex-start",
						md:
							"center",
					}}
					justify="space-between"
					direction={{
						base:
							"column",
						md:
							"row",
					}}
					gap="4"
				>
					<Box>
						<Heading
							size="sm"
							color="army.900"
						>
							{title}
						</Heading>

						{description && (
							<Text
								mt="1.5"
								fontSize="sm"
								color="gray.600"
								lineHeight="1.7"
							>
								{description}
							</Text>
						)}
					</Box>

					<Button
						size="sm"
						variant="ghost"
						rightIcon={
							<ArrowForwardIcon />
						}
						colorScheme="army"
						flexShrink={0}
						onClick={() =>
							navigate(
								"/dictionary",
							)
						}
					>
						전체 사전
					</Button>
				</Flex>

				<HStack
					mt="4"
					spacing="2"
					wrap="wrap"
				>
					{terms.map(
						(term) => (
							<Button
								key={
									term.id
								}
								size="sm"
								variant="outline"
								borderRadius="full"
								borderColor="army.300"
								bg="white"
								color="army.800"
								_hover={{
									bg:
										"army.50",
									borderColor:
										"army.500",
								}}
								onClick={() =>
									navigate(
										`/dictionary?term=${encodeURIComponent(
											term.id,
										)}`,
									)
								}
							>
								{term.term}
							</Button>
						),
					)}
				</HStack>
			</CardBody>
		</Card>
	);
}
