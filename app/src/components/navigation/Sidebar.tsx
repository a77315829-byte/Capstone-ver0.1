import {
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react";

import {
  Link as RouterLink,
  useLocation,
} from "react-router-dom";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItem {
  label: string;
  to: string;
  activePaths: string[];
  icon: string;
}

/**
 * ================================
 * 사이드바 메뉴
 * ================================
 */
const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "마이페이지",
    to: "/mypage",
    activePaths: ["/mypage"],
    icon: "/icons/home.svg",
  },
  {
    label: "실시간 차트",
    to: "/exchange",
    activePaths: [
      "/exchange",
      "/stocks",
    ],
    icon: "/icons/analytics-growth.svg",
  },
  {
    label: "과거 시나리오",
    to: "/scenario",
    activePaths: ["/scenario"],
    icon: "/icons/clock.svg",
  },
  {
    label: "실시간 뉴스",
    to: "/news",
    activePaths: ["/news"],
    icon: "/icons/document.svg",
  },
  {
    label: "금융 사전퀴즈",
    to: "/learn",
    activePaths: [
      "/learn",
      "/learning",
      "/finance-learning",
      "/dictionary",
      "/quiz",
    ],
    icon: "/icons/book.svg",
  },
];

/**
 * 현재 URL이 메뉴에 해당하는지 확인
 */
function isPathActive(
  pathname: string,
  activePaths: string[],
) {
  return activePaths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`),
  );
}

/**
 * ================================
 * SVG Mask 아이콘
 * ================================
 *
 * SVG 자체 색상을 사용하지 않고
 *
 * 일반 메뉴 → 진한 검정
 * 활성 메뉴 → 주황색
 *
 * 으로 통일하기 위한 컴포넌트.
 */
function SidebarIcon({
  src,
  active,
}: {
  src: string;
  active: boolean;
}) {
  const color = active
    ? "#F36F2A"
    : "#39322C";

  return (
    <Box
      w="19px"
      h="19px"
      flexShrink={0}
      bg={color}
      transition="background-color .15s ease"
      sx={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,

        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",

        WebkitMaskPosition: "center",
        maskPosition: "center",

        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

/**
 * ================================
 * 개별 메뉴
 * ================================
 */
function SidebarItem({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate?: () => void;
}) {
  const location = useLocation();

  const active = isPathActive(
    location.pathname,
    item.activePaths,
  );

  return (
    <Flex
      as={RouterLink}
      to={item.to}
      position="relative"
      h="46px"
      px="16px"
      align="center"
      gap="11px"
      borderRadius="7px"
      bg={
        active
          ? "#FFF4EC"
          : "transparent"
      }
      borderWidth="1px"
      borderColor={
        active
          ? "#F4D8C6"
          : "transparent"
      }
      color={
        active
          ? "#F36F2A"
          : "#39322C"
      }
      fontSize="13px"
      fontWeight={
        active
          ? "900"
          : "700"
      }
      textDecoration="none"
      transition="all .15s ease"
      _hover={{
        bg: active
          ? "#FFF4EC"
          : "#F7F0E7",
        textDecoration: "none",
      }}
      onClick={onNavigate}
    >
      {/* 왼쪽 활성 표시 막대 */}
      {active && (
        <Box
          position="absolute"
          left="-1px"
          top="8px"
          bottom="8px"
          w="3px"
          borderRadius="0 999px 999px 0"
          bg="#F36F2A"
        />
      )}

      <SidebarIcon
        src={item.icon}
        active={active}
      />

      <Text
        lineHeight="1"
        whiteSpace="nowrap"
      >
        {item.label}
      </Text>
    </Flex>
  );
}

/**
 * ================================
 * 사이드바 본문
 * ================================
 */
function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <Flex
      h="100%"
      minH="100vh"
      direction="column"
      px="14px"
      pt="15px"
      pb="22px"
    >
      {/* ===========================
          LOGO
      =========================== */}

      <Flex
        as={RouterLink}
        to="/mypage"
        align="center"
        justify="center"
        h="78px"
        mb="10px"
        overflow="hidden"
        textDecoration="none"
        onClick={onNavigate}
      >
        <Image
          src="/logo.png?v=4"
          alt="앤튜"
          w="188px"
          h="70px"
          objectFit="contain"
          transform="scale(1.22)"
        />
      </Flex>

      {/* ===========================
          NAVIGATION
      =========================== */}

      <Stack spacing="4px">
        {NAVIGATION_ITEMS.map(
          (item) => (
            <SidebarItem
              key={item.label}
              item={item}
              onNavigate={onNavigate}
            />
          ),
        )}
      </Stack>

      {/* ===========================
          연속 학습 정보
      =========================== */}

      <Box
        mt="auto"
        mx="2px"
        p="15px 16px"
        borderRadius="8px"
        bg="#F8F1E7"
        borderWidth="1px"
        borderColor="#E8DCCE"
      >
        <Flex
          align="center"
          gap="7px"
        >
          <Box
            w="7px"
            h="7px"
            borderRadius="full"
            bg="#F36F2A"
          />

          <Text
            fontSize="12px"
            fontWeight="900"
            color="#29231E"
          >
            연속 학습 3일째!
          </Text>
        </Flex>

        <Text
          mt="8px"
          fontSize="10px"
          lineHeight="1.6"
          color="#887D73"
        >
          꾸준함이 학습을 만듭니다.
        </Text>

        <Flex
          mt="10px"
          align="center"
          justify="space-between"
        >
          <Text
            fontSize="10px"
            fontWeight="800"
            color="#29231E"
          >
            3일 연속
          </Text>

          <Flex gap="3px">
            {[1, 2, 3].map(
              (day) => (
                <Box
                  key={day}
                  w="5px"
                  h="5px"
                  borderRadius="full"
                  bg="#F36F2A"
                />
              ),
            )}
          </Flex>
        </Flex>
      </Box>
    </Flex>
  );
}

/**
 * ================================
 * SIDEBAR
 * ================================
 */
export default function Sidebar({
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* ===========================
          DESKTOP
      =========================== */}

      <Box
        display={{
          base: "none",
          "2xl": "block",
        }}
        position="fixed"
        left="0"
        top="0"
        bottom="0"
        w="246px"
        bg="#FBF7EE"
        borderRightWidth="1px"
        borderColor="#E8DCCE"
        zIndex={1300}
        overflowY="auto"
      >
        <SidebarContent />
      </Box>

      {/* ===========================
          MOBILE / TABLET
      =========================== */}

      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        size="xs"
      >
        <DrawerOverlay />

        <DrawerContent
          bg="#FBF7EE"
        >
          <DrawerBody p="0">
            <SidebarContent
              onNavigate={onClose}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}