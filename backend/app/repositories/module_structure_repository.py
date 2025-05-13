from typing import Optional, List, Dict, Any, Set, Tuple
from sqlalchemy import select, exists, func, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.module_structure import ModuleStructureNode
from backend.app.models.module_content import ModuleContent
from backend.app.models.permission import Permission
from backend.app.repositories.base_repository import BaseRepository
from backend.app.schemas.module_structure import ModuleStructureNodeCreate, ModuleStructureNodeUpdate


class ModuleStructureRepository(BaseRepository[ModuleStructureNode, ModuleStructureNodeCreate, ModuleStructureNodeUpdate]):
    """
    ModuleStructureNode模型的数据库操作仓库
    """
    def __init__(self):
        super().__init__(ModuleStructureNode)
    
    async def get_by_id(self, db: AsyncSession, node_id: int) -> Optional[ModuleStructureNode]:
        """
        根据ID获取模块结构节点
        """
        try:
            result = await db.execute(
                select(ModuleStructureNode).where(ModuleStructureNode.id == node_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取模块节点失败: {str(e)}")
            raise
    
    async def get_all_nodes(self, db: AsyncSession) -> List[ModuleStructureNode]:
        """
        获取所有模块结构节点
        """
        try:
            result = await db.execute(
                select(ModuleStructureNode).order_by(ModuleStructureNode.order_index)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取所有模块节点失败: {str(e)}")
            raise
    
    async def get_nodes_by_workspace(self, db: AsyncSession, workspace_id: int) -> List[ModuleStructureNode]:
        """
        获取特定工作区的所有模块结构节点
        """
        try:
            result = await db.execute(
                select(ModuleStructureNode)
                .where(ModuleStructureNode.workspace_id == workspace_id)
                .order_by(ModuleStructureNode.order_index)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取工作区 {workspace_id} 的模块节点失败: {str(e)}")
            raise
    
    async def check_node_exists(self, db: AsyncSession, node_id: int) -> bool:
        """
        检查模块节点是否存在
        """
        try:
            result = await db.execute(
                select(exists().where(ModuleStructureNode.id == node_id))
            )
            return result.scalar()
        except Exception as e:
            logger.error(f"检查模块节点是否存在失败: {str(e)}")
            raise
    
    async def check_same_name_sibling(
        self, 
        db: AsyncSession, 
        name: str, 
        parent_id: Optional[int], 
        workspace_id: Optional[int] = None,
        exclude_id: Optional[int] = None
    ) -> bool:
        """
        检查同一级别下是否有同名节点
        """
        try:
            # 构建查询条件
            conditions = []
            
            # 名称条件
            conditions.append(ModuleStructureNode.name == name)
            
            # 父节点条件
            if parent_id is not None:
                conditions.append(ModuleStructureNode.parent_id == parent_id)
            else:
                conditions.append(ModuleStructureNode.parent_id.is_(None))
            
            # 工作区条件
            if workspace_id is not None:
                conditions.append(ModuleStructureNode.workspace_id == workspace_id)
            
            # 排除自身ID (更新时)
            if exclude_id is not None:
                conditions.append(ModuleStructureNode.id != exclude_id)
            
            # 执行查询
            query = select(exists().where(and_(*conditions)))
            result = await db.execute(query)
            return result.scalar()
            
        except Exception as e:
            logger.error(f"检查同级节点名称失败: {str(e)}")
            raise
    
    async def get_max_order_index(self, db: AsyncSession, parent_id: Optional[int], workspace_id: Optional[int] = None) -> int:
        """
        获取指定父节点下的最大排序索引
        """
        try:
            conditions = []
            
            # 父节点条件
            if parent_id is not None:
                conditions.append(ModuleStructureNode.parent_id == parent_id)
            else:
                conditions.append(ModuleStructureNode.parent_id.is_(None))
            
            # 工作区条件
            if workspace_id is not None:
                conditions.append(ModuleStructureNode.workspace_id == workspace_id)
            
            result = await db.execute(
                select(func.coalesce(func.max(ModuleStructureNode.order_index), -1))
                .where(and_(*conditions))
            )
            return result.scalar() + 1
        except Exception as e:
            logger.error(f"获取最大排序索引失败: {str(e)}")
            raise
    
    async def create_node(
        self, 
        db: AsyncSession, 
        node_data: Dict[str, Any], 
        permission_id: Optional[int] = None
    ) -> ModuleStructureNode:
        """
        创建模块结构节点
        """
        try:
            # 创建新节点
            db_node = ModuleStructureNode(**node_data)
            
            if permission_id:
                db_node.permission_id = permission_id
                
            db.add(db_node)
            await db.flush()
            await db.refresh(db_node)
            
            return db_node
        except Exception as e:
            logger.error(f"创建模块节点失败: {str(e)}")
            raise
    
    async def update_node(
        self, 
        db: AsyncSession, 
        node: ModuleStructureNode, 
        update_data: Dict[str, Any]
    ) -> ModuleStructureNode:
        """
        更新模块结构节点
        """
        try:
            for key, value in update_data.items():
                setattr(node, key, value)
            
            await db.flush()
            await db.refresh(node)
            
            return node
        except Exception as e:
            logger.error(f"更新模块节点失败: {str(e)}")
            raise
    
    async def update_node_permission(
        self, 
        db: AsyncSession, 
        permission: Permission, 
        permission_data: Dict[str, Any]
    ) -> Permission:
        """
        更新模块节点对应的权限
        """
        try:
            for key, value in permission_data.items():
                setattr(permission, key, value)
            
            await db.flush()
            await db.refresh(permission)
            
            return permission
        except Exception as e:
            logger.error(f"更新模块权限失败: {str(e)}")
            raise
    
    async def get_permission_by_id(self, db: AsyncSession, permission_id: int) -> Optional[Permission]:
        """
        根据权限ID获取权限记录
        """
        try:
            result = await db.execute(
                select(Permission).where(Permission.id == permission_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取权限记录失败: {str(e)}")
            raise
    
    async def create_permission(
        self, 
        db: AsyncSession, 
        permission_data: Dict[str, Any]
    ) -> Permission:
        """
        创建权限记录
        """
        try:
            db_permission = Permission(**permission_data)
            db.add(db_permission)
            await db.flush()
            await db.refresh(db_permission)
            
            return db_permission
        except Exception as e:
            logger.error(f"创建权限记录失败: {str(e)}")
            raise
    
    async def get_nodes_by_parent_id(
        self, 
        db: AsyncSession, 
        parent_id: Optional[int]
    ) -> List[ModuleStructureNode]:
        """
        获取指定父节点的所有子节点
        """
        try:
            if parent_id is not None:
                query = select(ModuleStructureNode).where(ModuleStructureNode.parent_id == parent_id)
            else:
                query = select(ModuleStructureNode).where(ModuleStructureNode.parent_id.is_(None))
            
            result = await db.execute(query)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"获取子节点失败: {str(e)}")
            raise
    
    async def get_all_child_ids(
        self, 
        db: AsyncSession, 
        parent_id: int
    ) -> Set[int]:
        """
        获取节点的所有子节点ID（递归）
        """
        try:
            # 获取直接子节点
            result = await db.execute(
                select(ModuleStructureNode.id).where(ModuleStructureNode.parent_id == parent_id)
            )
            child_ids = result.scalars().all()
            all_child_ids = set(child_ids)
            
            # 递归获取每个子节点的子节点
            for child_id in child_ids:
                children_of_child = await self.get_all_child_ids(db, child_id)
                all_child_ids.update(children_of_child)
            
            return all_child_ids
        except Exception as e:
            logger.error(f"获取所有子节点ID失败: {str(e)}")
            raise
    
    async def get_content_by_node_id(
        self, 
        db: AsyncSession, 
        node_id: int
    ) -> Optional[ModuleContent]:
        """
        获取节点关联的内容
        """
        try:
            result = await db.execute(
                select(ModuleContent).where(ModuleContent.module_node_id == node_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取节点内容失败: {str(e)}")
            raise
    
    async def delete_permission(
        self, 
        db: AsyncSession, 
        permission: Permission
    ) -> None:
        """
        删除权限记录
        """
        try:
            await db.delete(permission)
            await db.flush()
        except Exception as e:
            logger.error(f"删除权限记录失败: {str(e)}")
            raise
    
    async def delete_content(
        self, 
        db: AsyncSession, 
        content: ModuleContent
    ) -> None:
        """
        删除内容记录
        """
        try:
            await db.delete(content)
            await db.flush()
        except Exception as e:
            logger.error(f"删除内容记录失败: {str(e)}")
            raise
    
    async def delete_node(
        self, 
        db: AsyncSession, 
        node: ModuleStructureNode
    ) -> None:
        """
        删除节点
        """
        try:
            await db.delete(node)
            await db.flush()
        except Exception as e:
            logger.error(f"删除节点失败: {str(e)}")
            raise


# 创建模块结构仓库实例
module_structure_repository = ModuleStructureRepository() 