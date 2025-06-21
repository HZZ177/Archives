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
    name: str
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


class GlossaryItem(BaseModel):
    """术语表项模型"""
    id: str
    term: str
    explanation: str


# 添加API参数模型，与前端ApiParam对应
class ApiParam(BaseModel):
    """API参数模型"""
    name: str
    type: str
    required: bool = False
    description: Optional[str] = None
    example: Optional[str] = None
    children: Optional[List['ApiParam']] = None


# 添加工作区表引用模型
class WorkspaceTableReference(BaseModel):
    """工作区表引用模型"""
    id: int


# 添加工作区接口引用模型
class WorkspaceInterfaceReference(BaseModel):
    """工作区接口引用模型"""
    id: int


# 添加工作区表响应模型
class WorkspaceTableResponse(BaseModel):
    """工作区表响应模型"""
    id: int
    workspace_id: int
    name: str
    schema_name: Optional[str] = None
    description: Optional[str] = None
    columns_json: List[Dict[str, Any]] = []
    relationships_json: Optional[Dict[str, Any]] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 添加工作区接口响应模型
class WorkspaceInterfaceResponse(BaseModel):
    """工作区接口响应模型"""
    id: int
    workspace_id: int
    path: str
    method: str
    description: Optional[str] = None
    content_type: Optional[str] = None
    request_params_json: Optional[List[Dict[str, Any]]] = None
    response_params_json: Optional[List[Dict[str, Any]]] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ModuleContentBase(BaseModel):
    """模块内容的基础模型"""
    overview_text: Optional[str] = None
    details_text: Optional[str] = None
    database_tables_json: Optional[List[DatabaseTable]] = []  # 旧格式，保留向后兼容
    related_module_ids_json: Optional[List[int]] = []
    api_interfaces_json: Optional[List[ApiInterface]] = []  # 旧格式，保留向后兼容
    terminology_json: Optional[List[GlossaryItem]] = []
    table_relation_diagram: Optional[Dict[str, Any]] = None
    
    # 新增字段 - 引用工作区级别的表和接口
    database_table_refs: Optional[List[int]] = []  # 工作区表ID列表
    api_interface_refs: Optional[List[int]] = []  # 工作区接口ID列表


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
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    # 包含关联的工作区表和接口详情
    database_tables: Optional[List[WorkspaceTableResponse]] = []  # 工作区表详情
    api_interfaces: Optional[List[WorkspaceInterfaceResponse]] = []  # 工作区接口详情

    class Config:
        from_attributes = True 