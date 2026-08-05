"""시장 반응 시뮬레이션 요청 모델 (POST /simulate)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .analysis import InputType


class SelectedStock(BaseModel):
    """사용자가 선택한 종목."""

    code: str = Field(description="종목 코드")
    name: str = Field(description="종목명")


class ExternalStockData(BaseModel):
    """Node backend(KIS 연동)가 전달하는 실시간 시세.

    volume_trend/market_cap 은 포함하지 않는다(Node 에서 신뢰할 만한 값을 아직 계산하지 않음).
    이 필드가 없거나 current_price 가 없으면 stub 시세로 대체한다.
    """

    current_price: Optional[int] = Field(default=None, description="현재가")
    daily_change_rate: Optional[float] = Field(default=None, description="등락률(%)")
    observed_at: Optional[datetime] = Field(default=None, description="시세 관측 시각")


class SimulationRequest(BaseModel):
    """POST /simulate 요청 본문."""

    user_id: str = Field(description="로그인 사용자 식별자")
    selected_stock: SelectedStock = Field(description="선택 종목")
    input_text: str = Field(description="사용자 입력 텍스트(뉴스/이벤트/시나리오 등)")
    input_type_hint: Optional[InputType] = Field(
        default=None, description="입력 유형 힌트. 없으면 시스템이 분류"
    )
    stock_data: Optional[ExternalStockData] = Field(
        default=None, description="Node backend 가 전달하는 실시간 시세(선택)"
    )
