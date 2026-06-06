"""시장 반응 시뮬레이션 요청 모델 (POST /simulate)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from .analysis import InputType


class SelectedStock(BaseModel):
    """사용자가 선택한 종목."""

    code: str = Field(description="종목 코드")
    name: str = Field(description="종목명")


class SimulationRequest(BaseModel):
    """POST /simulate 요청 본문."""

    user_id: str = Field(description="로그인 사용자 식별자")
    selected_stock: SelectedStock = Field(description="선택 종목")
    input_text: str = Field(description="사용자 입력 텍스트(뉴스/이벤트/시나리오 등)")
    input_type_hint: Optional[InputType] = Field(
        default=None, description="입력 유형 힌트. 없으면 시스템이 분류"
    )
