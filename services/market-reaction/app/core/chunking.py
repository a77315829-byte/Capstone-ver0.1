"""문서를 구조적 경계(섹션) 기준으로 나누고, 섹션이 너무 길면 문단 단위로 재분할한다.

DART/EDGAR 원문 텍스트는 매우 길어(수십 페이지) 그대로 임베딩/프롬프트에 넣을 수 없다.
1차로 문서 자체의 구조적 제목 줄(heading_pattern)을 기준으로 섹션을 나누고,
2차로 각 섹션이 max_chars 를 넘으면 빈 줄로 구분된 문단 경계를 유지하며 재분할한다.
"""

from __future__ import annotations

import re
from typing import List, Tuple

DEFAULT_MAX_CHARS = 1500


def split_into_sections(text: str, heading_pattern: str) -> List[Tuple[str, str]]:
    """text 를 heading_pattern 에 매칭되는 줄 기준으로 (제목, 본문) 목록으로 나눈다.

    매칭되는 줄이 없으면 전체 text 를 제목 "" 인 섹션 하나로 반환한다.
    """
    matches = list(re.finditer(heading_pattern, text))
    if not matches:
        return [("", text)]

    sections: List[Tuple[str, str]] = []
    for i, match in enumerate(matches):
        start = match.start()
        # Skip leading newlines in the match (can happen if pattern uses \s*)
        while start < len(text) and text[start] == '\n':
            start += 1
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        line_end = text.find("\n", start)
        if line_end == -1 or line_end > end:
            line_end = end
        title = text[start:line_end].strip()
        body = text[line_end:end].strip()
        sections.append((title, body))
    return sections


def split_into_chunks(text: str, max_chars: int = DEFAULT_MAX_CHARS) -> List[str]:
    """빈 줄로 구분된 문단 경계를 유지하며 max_chars 이하 청크로 나눈다.

    단일 문단이 max_chars 를 넘으면 그 문단만 max_chars 단위로 강제 분할한다.
    """
    paragraphs = [p for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    if not paragraphs:
        return []

    chunks: List[str] = []
    current = ""
    for para in paragraphs:
        if len(para) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for start in range(0, len(para), max_chars):
                chunks.append(para[start : start + max_chars])
            continue

        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) > max_chars:
            chunks.append(current)
            current = para
        else:
            current = candidate

    if current:
        chunks.append(current)
    return chunks
