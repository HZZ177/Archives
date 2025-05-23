from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime


class DatabaseTableColumn(BaseModel):
    """数据库表字段模型"""
    field_name: str
    field_type: str
    length: Optional[int] = None  # 字段长度/精度
    nullable: bool = True  # 是否可为空
    default_value: Optional[str] = None  # 默认值
    description: Optional[str] = None  # 字段描述
    remark: Optional[str] = None  # 备注
    is_primary_key: bool = False  # 是否为主键
    is_unique: bool = False  # 是否唯一
    is_index: bool = False  # 是否索引
    foreign_key: Optional[Dict[str, str]] = None  # 外键信息


class ForeignKeyReference(BaseModel):
    """外键引用模型"""
    reference_table: str
    reference_column: str


class TableRelationship(BaseModel):
    """表关系模型"""
    to_table: str
    type: str  # 'one-to-one', 'one-to-many', 'many-to-many'
    description: Optional[str] = None


class DatabaseTable(BaseModel):
    """数据库表模型"""
    table_name: str
    schema_name: Optional[str] = None  # 模式名称
    description: Optional[str] = None  # 表描述
    columns: List[DatabaseTableColumn] = []
    relationships: Optional[List[TableRelationship]] = None  # 表关系


class ApiInterfaceParameter(BaseModel):
    """API接口参数模型"""
    param_name: str
    param_type: str
    required: Optional[bool] = False  # 适用于请求参数
    description: Optional[str] = None
    example: Optional[str] = None  # 参数示例值


class ApiInterface(BaseModel):
    """API接口模型"""
    # 前端目前发送的字段
    id: Optional[str] = None  # 前端使用的唯一标识符
    name: Optional[str] = None  # 接口名称
    type: Optional[str] = None  # 数据类型
    required: Optional[bool] = None  # 是否必需
    description: Optional[str] = None  # 说明

    # 保留原有字段，设为可选，保证向后兼容
    method: Optional[str] = None  # GET, POST, PUT, DELETE等
    path: Optional[str] = None
    request_params: List[ApiInterfaceParameter] = []
    response_params: List[ApiInterfaceParameter] = []


class ModuleContentBase(BaseModel):
    """模块内容的基础模型"""
    overview_text: Optional[str] = None
    details_text: Optional[str] = None
    database_tables_json: Optional[List[DatabaseTable]] = []
    related_module_ids_json: Optional[List[int]] = []
    api_interfaces_json: Optional[List[ApiInterface]] = []


class ModuleContentCreate(ModuleContentBase):
    """创建模块内容的请求模型"""
    module_node_id: int


class DiagramData(BaseModel):
    elements: list
    state: Dict[str, Any]
    version: Optional[int] = 1


class ModuleContentUpdate(ModuleContentBase):
    """更新模块内容的请求模型"""
    diagram_data: Optional[DiagramData] = None


class ModuleContentResponse(ModuleContentBase):
    """模块内容的响应模型"""
    id: int
    module_node_id: int
    diagram_image_path: Optional[str] = None
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True 