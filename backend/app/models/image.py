from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from backend.app.db.base import Base


class Image(Base):
    """图片模型，用于存储上传的图片信息"""
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String(255), nullable=False, comment="文件名")
    file_path = Column(String(500), nullable=False, comment="文件存储路径")
    url = Column(String(500), nullable=False, comment="图片访问URL")
    file_size = Column(Integer, nullable=True, comment="文件大小(字节)")
    mime_type = Column(String(100), nullable=True, comment="文件MIME类型")
    
    # 创建者和时间信息
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="创建者ID")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    
    # 关联模块ID (可选)
    module_id = Column(Integer, ForeignKey("module_structure_nodes.id", ondelete="SET NULL"), 
                      nullable=True, comment="关联的模块ID")
    
    # 关系
    creator = relationship("User", foreign_keys=[created_by], backref="uploaded_images")
    module = relationship("ModuleStructureNode", backref="images") 