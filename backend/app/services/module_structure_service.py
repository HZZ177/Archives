import uuid
from typing import Dict, List, Optional, Set, Tuple, Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logger import logger
from backend.app.models.module_content import ModuleContent
from backend.app.models.module_structure import ModuleStructureNode
from backend.app.models.permission import Permission, role_permission
from backend.app.models.user import User, Role
from backend.app.repositories.module_structure_repository import module_structure_repository
from backend.app.schemas.module_structure import (
    ModuleStructureNodeCreate, 
    ModuleStructureNodeUpdate,
    ModuleStructureNodeResponse
)


class ModuleStructureService:
    """
    模块结构相关的业务逻辑服务
    """
    
    async def get_module_tree(
        self,
        db: AsyncSession,
        parent_id: Optional[int] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        获取模块结构树
        
        :param db: 数据库会话
        :param parent_id: 父节点ID，如果指定则只返回该节点的子树
        :return: 模块结构树
        """
        try:
            # 获取所有节点
            all_nodes = await module_structure_repository.get_all_nodes(db)
            
            # 获取有内容的模块ID列表
            has_content_ids = set()
            for node in all_nodes:
                content = await module_structure_repository.get_content_by_node_id(db, node.id)
                if content:
                    has_content_ids.add(node.id)
            
            # 构建节点映射 {node_id: node_dict}
            nodes_by_id = {}
            for node in all_nodes:
                # 将SQLAlchemy对象转换为字典
                node_dict = {
                    "id": node.id,
                    "name": node.name,
                    "parent_id": node.parent_id,
                    "order_index": node.order_index,
                    "user_id": node.user_id,
                    "is_content_page": node.is_content_page,
                    "created_at": node.created_at,
                    "updated_at": node.updated_at,
                    "children": [],  # 初始化为空列表
                    "has_content": node.id in has_content_ids,
                    "permission_id": node.permission_id
                }
                nodes_by_id[node.id] = node_dict
            
            # 构建树结构
            root_nodes = []
            for node_id, node_dict in nodes_by_id.items():
                if node_dict["parent_id"] is None:
                    root_nodes.append(node_dict)
                else:
                    parent = nodes_by_id.get(node_dict["parent_id"])
                    if parent:
                        parent["children"].append(node_dict)
            
            # 对每个节点的子节点按order_index排序
            def sort_children(node):
                node["children"].sort(key=lambda x: x["order_index"])
                for child in node["children"]:
                    sort_children(child)
            
            for root in root_nodes:
                sort_children(root)
            
            # 如果指定了parent_id，则只返回该节点的子树
            if parent_id is not None:
                for node_id, node_dict in nodes_by_id.items():
                    if node_id == parent_id:
                        return {"items": [node_dict]}
                # 如果找不到指定的parent_id，返回空列表
                return {"items": []}
            
            return {"items": root_nodes}
            
        except Exception as e:
            logger.error(f"获取模块结构树失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模块结构树失败: {str(e)}"
            )
    
    async def get_module_node(
        self,
        db: AsyncSession,
        node_id: int
    ) -> Dict[str, Any]:
        """
        获取特定模块节点的详细信息
        
        :param db: 数据库会话
        :param node_id: 节点ID
        :return: 节点详细信息
        """
        try:
            # 查询节点
            node = await module_structure_repository.get_by_id(db, node_id)
            if not node:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块节点不存在"
                )
            
            # 查询是否有内容
            content = await module_structure_repository.get_content_by_node_id(db, node_id)
            has_content = content is not None
            
            # 构建响应对象
            response_dict = {
                "id": node.id,
                "name": node.name,
                "parent_id": node.parent_id,
                "order_index": node.order_index,
                "user_id": node.user_id,
                "is_content_page": node.is_content_page,
                "created_at": node.created_at,
                "updated_at": node.updated_at,
                "children": [],  # 单个节点不包含子节点
                "has_content": has_content,
                "permission_id": node.permission_id
            }
            
            return response_dict
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取模块节点详情失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取模块节点详情失败: {str(e)}"
            )
    
    async def create_module_node(
        self,
        db: AsyncSession,
        node_in: ModuleStructureNodeCreate,
        user: User
    ) -> Dict[str, Any]:
        """
        创建模块结构节点
        
        :param db: 数据库会话
        :param node_in: 节点创建数据
        :param user: 当前用户
        :return: 创建的节点信息
        """
        try:
            # 如果指定了父节点，验证其存在性
            if node_in.parent_id:
                parent_exists = await module_structure_repository.check_node_exists(db, node_in.parent_id)
                if not parent_exists:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="父节点不存在"
                    )
            
            # 检查同一父节点下是否已存在同名节点
            has_same_name = await module_structure_repository.check_same_name_sibling(
                db, node_in.name, node_in.parent_id
            )
            if has_same_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="同一级别下已存在同名节点"
                )
            
            # 确定order_index: 如果未提供，则使用当前最大值+1
            if node_in.order_index is None:
                node_in.order_index = await module_structure_repository.get_max_order_index(db, node_in.parent_id)
                
            # 权限相关设置
            page_path = "/module-content/"  # 完整路径会在模块创建后更新
            permission_parent_id = None
            parent_node = None
            
            # 如果有父模块，查找父模块对应的权限记录
            if node_in.parent_id:
                parent_node = await module_structure_repository.get_by_id(db, node_in.parent_id)
                if parent_node and parent_node.permission_id:
                    permission_parent_id = parent_node.permission_id
            
            # 创建一个临时唯一code
            temp_code = f"module:temp_{uuid.uuid4().hex[:8]}"
            
            # 创建权限记录
            permission_data = {
                "code": temp_code,
                "name": node_in.name,
                "page_path": page_path,
                "is_visible": True,
                "description": f"访问用户自定义模块: {node_in.name}",
                "parent_id": permission_parent_id
            }
            
            db_permission = await module_structure_repository.create_permission(db, permission_data)
            
            # 创建节点记录
            node_data = {
                "name": node_in.name,
                "parent_id": node_in.parent_id,
                "order_index": node_in.order_index,
                "user_id": user.id,
                "is_content_page": node_in.is_content_page,
                "permission_id": db_permission.id
            }
            
            db_node = await module_structure_repository.create_node(db, node_data)
            
            # 更新权限记录中的页面路径和代码
            permission_update = {
                "page_path": f"/module-content/{db_node.id}",
                "code": f"module:{db_node.id}"
            }
            
            await module_structure_repository.update_node_permission(db, db_permission, permission_update)
            
            # 如果是内容页面类型，自动创建一个空的内容记录
            has_content = False
            if db_node.is_content_page:
                # 创建新的内容记录
                content_data = {
                    "module_node_id": db_node.id,
                    "user_id": user.id,
                    "overview_text": "",
                    "details_text": "",
                    "database_tables_json": [],
                    "related_module_ids_json": [],
                    "api_interfaces_json": []
                }
                
                # 暂未实现ModuleContentRepository的create方法，使用模型直接创建
                db_content = ModuleContent(**content_data)
                db.add(db_content)
                has_content = True
            
            # 将新节点的权限分配给有权访问父节点的角色
            if parent_node and parent_node.permission_id:
                await self.assign_permission_to_roles(db, parent_node.permission_id, db_permission)
            
            # 提交事务
            await db.commit()
            
            # 构建响应对象
            response_dict = {
                "id": db_node.id,
                "name": db_node.name,
                "parent_id": db_node.parent_id,
                "order_index": db_node.order_index,
                "user_id": db_node.user_id,
                "is_content_page": db_node.is_content_page,
                "created_at": db_node.created_at,
                "updated_at": db_node.updated_at,
                "children": [],
                "has_content": has_content,
                "permission_id": db_node.permission_id
            }
            
            return response_dict
            
        except HTTPException:
            await db.rollback()
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"创建模块节点失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建模块节点失败: {str(e)}"
            )
    
    async def update_module_node(
        self,
        db: AsyncSession,
        node_id: int,
        node_in: ModuleStructureNodeUpdate,
        user: User
    ) -> Dict[str, Any]:
        """
        更新模块结构节点
        
        :param db: 数据库会话
        :param node_id: 节点ID
        :param node_in: 节点更新数据
        :param user: 当前用户
        :return: 更新后的节点信息
        """
        try:
            # 查询节点
            node = await module_structure_repository.get_by_id(db, node_id)
            if not node:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块节点不存在"
                )
            
            # 如果更新了名称，检查同一父节点下是否已存在同名节点
            if node_in.name is not None and node_in.name != node.name:
                has_same_name = await module_structure_repository.check_same_name_sibling(
                    db, node_in.name, node.parent_id, node_id
                )
                if has_same_name:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="同一级别下已存在同名节点"
                    )
            
            # 如果更新了父节点，验证新父节点的存在性
            if node_in.parent_id is not None and node_in.parent_id != node.parent_id:
                # 检查新父节点是否存在
                parent_exists = await module_structure_repository.check_node_exists(db, node_in.parent_id)
                if not parent_exists:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="父节点不存在"
                    )
                
                # 检查是否将节点移动到其子节点下（避免循环引用）
                child_ids = await module_structure_repository.get_all_child_ids(db, node_id)
                if node_in.parent_id in child_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="不能将节点移动到其子节点下"
                    )
            
            # 更新节点信息
            update_data = {}
            for field, value in node_in.model_dump(exclude_unset=True).items():
                update_data[field] = value
            
            updated_node = await module_structure_repository.update_node(db, node, update_data)
            
            # 如果更新了名称，同时更新对应的权限记录
            if node_in.name and node.permission_id:
                permission = await module_structure_repository.get_permission_by_id(db, node.permission_id)
                if permission:
                    permission_update = {
                        "name": node_in.name,
                        "description": f"访问用户自定义模块: {node_in.name}"
                    }
                    await module_structure_repository.update_node_permission(db, permission, permission_update)
            
            # 提交事务
            await db.commit()
            
            # 查询是否有内容
            content = await module_structure_repository.get_content_by_node_id(db, node_id)
            has_content = content is not None
            
            # 构建响应对象
            response_dict = {
                "id": updated_node.id,
                "name": updated_node.name,
                "parent_id": updated_node.parent_id,
                "order_index": updated_node.order_index,
                "user_id": updated_node.user_id,
                "is_content_page": updated_node.is_content_page,
                "created_at": updated_node.created_at,
                "updated_at": updated_node.updated_at,
                "children": [],  # 单个节点不包含子节点
                "has_content": has_content,
                "permission_id": updated_node.permission_id
            }
            
            return response_dict
            
        except HTTPException:
            await db.rollback()
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"更新模块节点失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新模块节点失败: {str(e)}"
            )
    
    async def delete_module_node(
        self,
        db: AsyncSession,
        node_id: int,
        user: User
    ) -> str:
        """
        删除模块结构节点及其所有子节点
        
        :param db: 数据库会话
        :param node_id: 节点ID
        :param user: 当前用户
        :return: 成功消息
        """
        try:
            # 查询节点
            node = await module_structure_repository.get_by_id(db, node_id)
            if not node:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="模块节点不存在"
                )
            
            # 递归删除节点及其所有子节点
            await self.delete_module_node_recursive(db, node_id)
            
            # 提交事务
            await db.commit()
            
            return "模块节点及其所有子节点删除成功"
            
        except HTTPException:
            await db.rollback()
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"删除模块节点失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除模块节点失败: {str(e)}"
            )
    
    async def delete_module_node_recursive(
        self,
        db: AsyncSession,
        node_id: int
    ) -> None:
        """
        递归删除节点及其所有子节点（内部方法）
        
        :param db: 数据库会话
        :param node_id: 节点ID
        """
        try:
            # 获取所有子节点
            children = await module_structure_repository.get_nodes_by_parent_id(db, node_id)
            
            # 对每个子节点递归删除
            for child in children:
                await self.delete_module_node_recursive(db, child.id)
            
            # 删除该节点的关联内容
            content = await module_structure_repository.get_content_by_node_id(db, node_id)
            if content:
                await module_structure_repository.delete_content(db, content)
            
            # 删除关联的权限记录
            node = await module_structure_repository.get_by_id(db, node_id)
            if node and node.permission_id:
                permission = await module_structure_repository.get_permission_by_id(db, node.permission_id)
                if permission:
                    await module_structure_repository.delete_permission(db, permission)
            
            # 删除节点本身
            if node:
                await module_structure_repository.delete_node(db, node)
            
            # 记录日志
            logger.info(f"已删除节点: {node_id}")
            
        except Exception as e:
            logger.error(f"递归删除节点失败: {str(e)}")
            raise
    
    async def assign_permission_to_roles(
        self,
        db: AsyncSession,
        parent_permission_id: int,
        new_permission: Permission
    ) -> None:
        """
        将权限分配给拥有父权限的角色
        
        :param db: 数据库会话
        :param parent_permission_id: 父权限ID
        :param new_permission: 新创建的权限
        """
        try:
            # 为了支持在异步环境中使用 ORM 的多对多关系，需要使用 run_sync
            # 查询拥有父节点权限的所有角色
            async def get_roles_with_permission(permission_id: int) -> List[Role]:
                result = await db.execute(text("""
                    SELECT r.* FROM roles r
                    JOIN role_permission rp ON r.id = rp.role_id
                    WHERE rp.permission_id = :permission_id
                """), {"permission_id": permission_id})
                return result.fetchall()
            
            roles_with_parent_permission = await get_roles_with_permission(parent_permission_id)
            
            # 将新权限分配给这些角色
            for role_data in roles_with_parent_permission:
                # 使用原始SQL执行插入
                await db.execute(text("""
                    INSERT INTO role_permission (role_id, permission_id)
                    VALUES (:role_id, :permission_id)
                """), {"role_id": role_data.id, "permission_id": new_permission.id})
                
                logger.info(f"权限继承: 已将权限 '{new_permission.code}' 从父节点继承并分配给角色 '{role_data.name}'")
            
        except Exception as e:
            logger.error(f"分配权限给角色失败: {str(e)}")
            raise


# 创建模块结构服务实例
module_structure_service = ModuleStructureService() 