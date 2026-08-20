import {
  Box,
  Button,
  Flex,
  Grid,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Text,
} from "@chakra-ui/react";

/* =========================================================
   TYPES
========================================================= */

type OrderSide = "BUY" | "SELL";

type OrderRecord = {
  order_id?: string;

  session_id?: string;

  user_id?: string;

  scenario_id?: string;

  turn_no?: number;

  market_date?: string;

  asset_id: string;

  side: OrderSide;

  order_type?:
    | "MARKET"
    | "LIMIT";

  limit_price?:
    | number
    | null;

  requested_quantity?: number;

  filled_quantity?: number;

  cancelled_quantity?: number;

  quantity: number;

  execution_price?:
    | number
    | null;

  average_execution_price?:
    | number
    | null;

  amount: number;

  realized_pnl?: number;

  status?: string;

  time_in_force?: string;

  fills?: Array<{
    price: number;
    quantity: number;
    amount: number;
  }>;

  price_basis?: string;

  created_at?: string;
};

type Props = {
  isOpen: boolean;

  onClose: () => void;

  order:
    | OrderRecord
    | null;

  assetName: string;
};

/* =========================================================
   DESIGN
========================================================= */

const ORANGE = "#F36F2A";

const ORANGE_DARK =
  "#D95E20";

const TEXT = "#29231E";

const MUTED = "#8C8177";

const BORDER = "#E8DCCE";

const BUY = "#E85B47";

const SELL = "#3C70D8";

/* =========================================================
   FORMAT
========================================================= */

const krw =
  new Intl.NumberFormat(
    "ko-KR",
  );

function formatWon(
  value?:
    | number
    | null,
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(
      Number(value),
    )
  ) {
    return "-";
  }

  return `${krw.format(
    Math.round(
      Number(value),
    ),
  )}원`;
}

function formatQuantity(
  value?:
    | number
    | null,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "-";
  }

  return `${krw.format(
    value,
  )}주`;
}

/* =========================================================
   INFO ROW
========================================================= */

function OrderInfoRow({
  label,
  children,
}: {
  label: string;

  children:
    React.ReactNode;
}) {
  return (
    <Grid
      templateColumns="86px minmax(0, 1fr)"
      minH="31px"
      alignItems="center"
    >
      <Text
        fontSize="10px"
        color={MUTED}
      >
        {label}
      </Text>

      <Flex
        justify="flex-end"
        minW="0"
      >
        {children}
      </Flex>
    </Grid>
  );
}

/* =========================================================
   ORDER SUCCESS MODAL
========================================================= */

export default function ScenarioOrderSuccessModal({
  isOpen,
  onClose,
  order,
  assetName,
}: Props) {
  if (!order) {
    return null;
  }

  const isBuy =
    order.side === "BUY";

  /*
   * 서버에서 평균 체결가가 존재하면
   * 평균 체결가 우선.
   */
  const executionPrice =
    order.average_execution_price ??
    order.execution_price ??
    null;

  /*
   * 실제 체결 수량이 존재하면 체결 수량,
   * 없으면 기본 quantity 사용.
   */
  const quantity =
    order.filled_quantity ??
    order.quantity;

  const sideColor =
    isBuy
      ? BUY
      : SELL;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="sm"
      closeOnOverlayClick={
        false
      }
    >
      {/* =================================
          BACKGROUND
      ================================= */}

      <ModalOverlay
        bg="rgba(35, 31, 27, 0.48)"
        backdropFilter="blur(1px)"
      />

      {/* =================================
          MODAL
      ================================= */}

      <ModalContent
        w={{
          base:
            "calc(100% - 32px)",

          sm:
            "390px",
        }}
        maxW="390px"
        m="0"
        bg="white"
        borderRadius="14px"
        borderWidth="1px"
        borderColor={BORDER}
        boxShadow="0 18px 50px rgba(47, 35, 25, 0.19)"
        overflow="hidden"
      >
        {/* =================================
            CLOSE
        ================================= */}

        <ModalCloseButton
          top="12px"
          right="12px"
          w="28px"
          h="28px"
          color="#8D837B"
          borderRadius="full"
          fontSize="11px"
          _hover={{
            bg:
              "#F7F2ED",
          }}
        />

        {/* =================================
            CONTENT
        ================================= */}

        <ModalBody
          px="24px"
          pt="27px"
          pb="13px"
        >
          {/* =================================
              CHECK ICON
          ================================= */}

          <Flex
            justify="center"
          >
            <Image
              src="/icons/verified.svg"
              alt="주문 완료"
              w="32px"
              h="32px"
              objectFit="contain"
            />
          </Flex>

          {/* =================================
              TITLE
          ================================= */}

          <Text
            mt="10px"
            textAlign="center"
            fontSize="16px"
            lineHeight="1.45"
            letterSpacing="-0.035em"
            fontWeight="900"
            color={TEXT}
          >
            {isBuy
              ? "매수"
              : "매도"}{" "}
            주문이 접수되었습니다!
          </Text>

          <Text
            mt="5px"
            textAlign="center"
            fontSize="9px"
            lineHeight="1.6"
            color="#9B9188"
          >
            주문 내용을
            확인해주세요.
          </Text>

          {/* =================================
              ORDER INFO
          ================================= */}

          <Box
            mt="17px"
            px="15px"
            py="11px"
            bg="#FFFCF8"
            borderWidth="1px"
            borderColor="#EDE3D9"
            borderRadius="9px"
          >
            {/* 종목 */}

            <OrderInfoRow
              label="종목명"
            >
              <Flex
                align="baseline"
                gap="5px"
                minW="0"
              >
                <Text
                  fontSize="10px"
                  fontWeight="900"
                  color={TEXT}
                  noOfLines={1}
                >
                  {assetName ||
                    order.asset_id}
                </Text>

                {assetName && (
                  <Text
                    flexShrink={0}
                    fontSize="8px"
                    color="#A0968D"
                  >
                    {
                      order.asset_id
                    }
                  </Text>
                )}
              </Flex>
            </OrderInfoRow>

            {/* 구분 */}

            <OrderInfoRow
              label="주문 구분"
            >
              <Text
                fontSize="10px"
                fontWeight="900"
                color={
                  sideColor
                }
              >
                {isBuy
                  ? "매수"
                  : "매도"}
              </Text>
            </OrderInfoRow>

            {/* 주문 유형 */}

            <OrderInfoRow
              label="주문 유형"
            >
              <Text
                fontSize="10px"
                fontWeight="800"
                color={TEXT}
              >
                {order.order_type ===
                "LIMIT"
                  ? "지정가"
                  : "시장가"}
              </Text>
            </OrderInfoRow>

            {/* 수량 */}

            <OrderInfoRow
              label="주문 수량"
            >
              <Text
                fontSize="10px"
                fontWeight="800"
                color={TEXT}
              >
                {formatQuantity(
                  quantity,
                )}
              </Text>
            </OrderInfoRow>

            {/* 체결가 */}

            <OrderInfoRow
              label="체결 가격"
            >
              <Text
                fontSize="10px"
                fontWeight="800"
                color={TEXT}
              >
                {formatWon(
                  executionPrice,
                )}
              </Text>
            </OrderInfoRow>

            {/* divider */}

            <Box
              my="7px"
              borderTopWidth="1px"
              borderColor="#EFE6DE"
            />

            {/* 총 금액 */}

            <OrderInfoRow
              label="주문 금액"
            >
              <Text
                fontSize="11px"
                fontWeight="900"
                color={TEXT}
              >
                {formatWon(
                  order.amount,
                )}
              </Text>
            </OrderInfoRow>
          </Box>

          {/* =================================
              STATUS MESSAGE
          ================================= */}

          <Flex
            mt="10px"
            justify="center"
            align="center"
            gap="5px"
          >
            <Box
              w="4px"
              h="4px"
              borderRadius="full"
              bg={ORANGE}
            />

            <Text
              fontSize="8px"
              color="#9C9188"
            >
              주문 내역은
              체결 내역에서 다시
              확인할 수 있습니다.
            </Text>
          </Flex>
        </ModalBody>

        {/* =================================
            CONFIRM
        ================================= */}

        <ModalFooter
          px="24px"
          pt="3px"
          pb="21px"
          borderTopWidth="0"
        >
          <Button
            w="100%"
            h="40px"
            bg={ORANGE}
            color="white"
            borderRadius="8px"
            fontSize="11px"
            fontWeight="900"
            _hover={{
              bg:
                ORANGE_DARK,
            }}
            _active={{
              bg:
                ORANGE_DARK,
            }}
            onClick={onClose}
          >
            확인
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}