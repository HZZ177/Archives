"""AI服务专用异常类"""


class AIServiceException(Exception):
    """AI服务基础异常"""
    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class LLMConnectionException(AIServiceException):
    """LLM连接异常"""
    def __init__(self, message: str):
        super().__init__(message, "LLM_CONNECTION_ERROR")


class AgentExecutionException(AIServiceException):
    """Agent执行异常"""
    def __init__(self, message: str):
        super().__init__(message, "AGENT_EXECUTION_ERROR")


class ConfigurationException(AIServiceException):
    """配置异常"""
    def __init__(self, message: str):
        super().__init__(message, "CONFIGURATION_ERROR")


class PoolExhaustedException(AIServiceException):
    """连接池耗尽异常"""
    def __init__(self, message: str):
        super().__init__(message, "POOL_EXHAUSTED_ERROR")


class ModelNotFoundException(AIServiceException):
    """模型未找到异常"""
    def __init__(self, message: str):
        super().__init__(message, "MODEL_NOT_FOUND_ERROR")


class ValidationException(AIServiceException):
    """数据验证异常"""
    def __init__(self, message: str):
        super().__init__(message, "VALIDATION_ERROR")
