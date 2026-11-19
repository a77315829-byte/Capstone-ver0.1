import { HStack, Link } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
export default function LegalLinks() {
 return <HStack as="nav" aria-label="이용 안내" justify="center" spacing="4" py="3" fontSize="xs">
  <Link as={RouterLink} to="/privacy">개인정보 처리방침 (초안)</Link>
  <Link as={RouterLink} to="/terms">이용약관 (초안)</Link>
 </HStack>;
}
