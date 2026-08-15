class PlayError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class DataUnavailableError(PlayError):
    def __init__(self, message: str) -> None:
        super().__init__("MARKET_DATA_UNAVAILABLE", message, 503)
