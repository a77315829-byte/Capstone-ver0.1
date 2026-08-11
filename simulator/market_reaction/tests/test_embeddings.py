"""embeddings.py 테스트 (offline → EmbeddingError 경로).

성공 경로(실제 Ollama 가 임베딩을 반환하는 경우)는 이 코드베이스의 다른 LLM 클라이언트와
동일하게 pytest 대상이 아니며, 로컬에서 Ollama 를 띄운 뒤 수동으로 확인한다.
"""

import pytest

from app.services.embeddings import EmbeddingError, embed_text


@pytest.mark.asyncio
async def test_offline_raises_embedding_error(offline):
    with pytest.raises(EmbeddingError):
        await embed_text("삼성전자 HBM 실적 개선")
