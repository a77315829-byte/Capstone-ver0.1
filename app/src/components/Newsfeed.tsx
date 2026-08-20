import React, { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Flex,
  Grid,
  Image,
  Link,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import axios from "axios";

interface NewsItem {
  title: string;
  description: string;
  publishedAt: string;
  symbols?: string[];
  source: string;
  sourceUrl: string;
  imageUrl?: string | null;
}

interface NewsfeedProps {
  symbol: string;
  name?: string;
  market?: string;
  layout?: "grid" | "list";
}

const ORANGE = "#F36F2A";
const BORDER = "#E8DCCE";
const TEXT = "#2B251F";
const MUTED = "#887D73";

function timeSince(dateString: string): string {
  const targetTime = new Date(dateString).getTime();
  if (Number.isNaN(targetTime)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - targetTime) / 1000));
  const intervals = [
    { label: "년", seconds: 31_536_000 },
    { label: "개월", seconds: 2_592_000 },
    { label: "일", seconds: 86_400 },
    { label: "시간", seconds: 3_600 },
    { label: "분", seconds: 60 },
  ];

  for (const interval of intervals) {
    const value = Math.floor(seconds / interval.seconds);
    if (value >= 1) return `${value}${interval.label} 전`;
  }
  return "방금 전";
}

function sourceLabel(source: string) {
  return (source || "뉴스").replace(/^www\./, "").toUpperCase();
}

function NewsThumbnail({ item, isList }: { item: NewsItem; isList: boolean }) {
  const [failed, setFailed] = useState(false);

  if (!item.imageUrl || failed) {
    return (
      <Flex
        w="100%"
        h="100%"
        minH={isList ? "142px" : "168px"}
        align="center"
        justify="center"
        direction="column"
        bgGradient="linear(to-br, #F2E8DD, #FFF9F3)"
        color="#B49A84"
      >
        <Text fontSize="11px" fontWeight="900" letterSpacing="0.08em">NEWS</Text>
        <Text mt="3px" fontSize="8px" maxW="120px" textAlign="center" noOfLines={1}>
          {item.source}
        </Text>
      </Flex>
    );
  }

  return (
    <Image
      src={item.imageUrl}
      alt=""
      w="100%"
      h="100%"
      minH={isList ? "142px" : "168px"}
      objectFit="cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function NewsCard({
  item,
  layout,
}: {
  item: NewsItem;
  layout: "grid" | "list";
}) {
  const isList = layout === "list";

  return (
    <Link href={item.sourceUrl} isExternal color="inherit" _hover={{ textDecoration: "none" }}>
      <Box
        h="100%"
        bg="white"
        borderWidth="1px"
        borderColor={BORDER}
        borderRadius="12px"
        overflow="hidden"
        transition="all .16s ease"
        _hover={{
          transform: "translateY(-2px)",
          borderColor: "#E8B58F",
          boxShadow: "0 10px 28px rgba(73,52,30,.08)",
        }}
      >
        {isList ? (
          <Grid templateColumns={{ base: "1fr", md: "220px minmax(0,1fr)" }} minH={{ md: "166px" }}>
            <Box minH={{ base: "176px", md: "166px" }} bg="#F5EEE7" overflow="hidden">
              <NewsThumbnail item={item} isList />
            </Box>

            <Flex p={{ base: "16px", md: "17px 20px" }} direction="column" minW="0">
              <Flex align="center" gap="8px">
                <Badge
                  bg="#F0EAE4"
                  color="#63584F"
                  borderRadius="5px"
                  px="7px"
                  py="2px"
                  maxW="190px"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  fontSize="8px"
                >
                  {sourceLabel(item.source)}
                </Badge>
                <Text ml="auto" fontSize="9px" fontWeight="700" color={MUTED} whiteSpace="nowrap">
                  {timeSince(item.publishedAt)}
                </Text>
              </Flex>

              <Text mt="10px" fontSize={{ base: "14px", md: "15px" }} fontWeight="900" lineHeight="1.45" letterSpacing="-0.025em" color={TEXT} noOfLines={2}>
                {item.title}
              </Text>

              <Text mt="7px" fontSize="10px" lineHeight="1.7" color="#6F655C" noOfLines={2}>
                {item.description || "기사 요약이 제공되지 않습니다."}
              </Text>

              <Flex mt="auto" pt="10px" align="center">
                {Array.isArray(item.symbols) && item.symbols.length > 0 && (
                  <Text fontSize="9px" fontWeight="800" color="#9B8F84">
                    {item.symbols.join(", ")}
                  </Text>
                )}
                <Text ml="auto" fontSize="10px" fontWeight="900" color={ORANGE}>
                  원문 보기 ›
                </Text>
              </Flex>
            </Flex>
          </Grid>
        ) : (
          <Flex h="100%" direction="column">
            <Box h="168px" bg="#F5EEE7" overflow="hidden">
              <NewsThumbnail item={item} isList={false} />
            </Box>
            <Flex flex="1" direction="column" p="16px">
              <Flex align="center">
                <Badge bg="#F0EAE4" color="#63584F" borderRadius="5px" px="7px" py="2px" maxW="160px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" fontSize="8px">
                  {sourceLabel(item.source)}
                </Badge>
                <Text ml="auto" fontSize="9px" color={MUTED}>{timeSince(item.publishedAt)}</Text>
              </Flex>
              <Text mt="10px" fontSize="14px" fontWeight="900" lineHeight="1.5" color={TEXT} noOfLines={2}>{item.title}</Text>
              <Text mt="7px" fontSize="10px" lineHeight="1.7" color="#6F655C" noOfLines={3}>
                {item.description || "기사 요약이 제공되지 않습니다."}
              </Text>
              <Text mt="auto" pt="12px" textAlign="right" fontSize="10px" fontWeight="900" color={ORANGE}>원문 보기 ›</Text>
            </Flex>
          </Flex>
        )}
      </Box>
    </Link>
  );
}

export default function Newsfeed({
  symbol,
  name = "",
  market = "",
  layout = "grid",
}: NewsfeedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const fetchNews = async () => {
      if (!symbol) {
        setNews([]);
        setErrorMessage("");
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await axios.get(`/api/news/${encodeURIComponent(symbol)}`, {
          params: { name, market },
        });

        if (!mounted) return;
        setNews(Array.isArray(response.data) ? response.data.slice(0, 12) : []);
      } catch (error: any) {
        console.error("뉴스 조회 실패:", error);
        if (!mounted) return;
        setNews([]);
        setErrorMessage(error?.response?.data?.message || "뉴스를 불러오지 못했습니다.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void fetchNews();
    return () => {
      mounted = false;
    };
  }, [symbol, name, market]);

  if (isLoading) {
    return (
      <Stack spacing="12px">
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid key={index} templateColumns={{ base: "1fr", md: "220px 1fr" }} borderWidth="1px" borderColor={BORDER} borderRadius="12px" overflow="hidden" bg="white">
            <Skeleton h={{ base: "176px", md: "166px" }} />
            <Box p="18px">
              <Skeleton h="12px" w="120px" />
              <Skeleton mt="14px" h="18px" w="75%" />
              <Skeleton mt="8px" h="12px" w="92%" />
              <Skeleton mt="6px" h="12px" w="68%" />
            </Box>
          </Grid>
        ))}
      </Stack>
    );
  }

  if (errorMessage) {
    return (
      <Flex minH="220px" align="center" justify="center" borderWidth="1px" borderColor={BORDER} borderRadius="12px" bg="white">
        <Stack align="center" spacing="5px">
          <Text fontWeight="900" color={TEXT}>뉴스를 불러오지 못했습니다.</Text>
          <Text fontSize="10px" color="#C75647" textAlign="center">{errorMessage}</Text>
        </Stack>
      </Flex>
    );
  }

  if (news.length === 0) {
    return (
      <Flex minH="220px" align="center" justify="center" borderWidth="1px" borderColor={BORDER} borderRadius="12px" bg="white">
        <Text fontSize="11px" fontWeight="800" color={MUTED}>선택한 종목과 관련된 최신 기사가 없습니다.</Text>
      </Flex>
    );
  }

  if (layout === "list") {
    return (
      <Stack spacing="12px">
        {news.map((item, index) => (
          <NewsCard key={`${item.sourceUrl}-${index}`} item={item} layout="list" />
        ))}
      </Stack>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing="14px">
      {news.map((item, index) => (
        <NewsCard key={`${item.sourceUrl}-${index}`} item={item} layout="grid" />
      ))}
    </SimpleGrid>
  );
}