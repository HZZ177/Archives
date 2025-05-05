from typing import Optional

from pydantic import BaseModel, Field


class Token(BaseModel):
    """
    访问令牌模型
    """
    access_token: str
    token_type: str


class TokenPayload(BaseModel):
    """
    令牌数据载荷
    """
    user_id: str = Field(..., alias="sub")

    class Config:
        populate_by_name = True
