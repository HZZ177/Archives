from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, exists, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api.deps import get_current_active_user, get_db, success_response, error_response
from backend.app.core.logger import logger
from backend.app.models.module_structure import ModuleStructureNode
from backend.app.models.module_content import ModuleContent
from backend.app.models.user import User, Role
from backend.app.models.permission import Permission, role_permission
from backend.app.schemas.module_structure import (
    ModuleStructureNodeCreate,
    ModuleStructureNodeResponse,
    ModuleStructureNodeUpdate,
    ModuleTreeResponse
)
from backend.app.schemas.response import APIResponse

router = APIRouter()


@router.post("/", response_model=APIResponse[ModuleStructureNodeResponse], status_code=status.HTTP_201_CREATED)
async def create_module_node(
        node_in: ModuleStructureNodeCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建模块结构节点
    """
    try:
        # 如果指定了父节点，验证其存在性
        if node_in.parent_id:
            parent_exists = await db.execute(
                select(exists().where(ModuleStructureNode.id == node_in.parent_id))
            )
            if not parent_exists.scalar():
                return error_response(message="父节点不存在")
        
        # 检查同一父节点下是否已存在同名节点
        if node_in.parent_id is not None:
            # 如果有父节点，检查同一父节点下是否有同名节点
            name_exists_query = select(ModuleStructureNode).where(
                ModuleStructureNode.name == node_in.name,
                ModuleStructureNode.parent_id == node_in.parent_id
            )
        else:
            # 如果是顶级节点，检查顶级节点中是否有同名节点
            name_exists_query = select(ModuleStructureNode).where(
                ModuleStructureNode.name == node_in.name,
                ModuleStructureNode.parent_id.is_(None)
            )
        
        name_exists_result = await db.execute(name_exists_query)
        if name_exists_result.first() is not None:
            return error_response(message="同一级别下已存在同名节点")

        # 确定order_index: 如果未提供，则使用当前最大值+1
        if node_in.order_index is None:
            parent_id_clause = ModuleStructureNode.parent_id == node_in.parent_id if node_in.parent_id else ModuleStructureNode.parent_id is None
            max_order_result = await db.execute(
                select(func.coalesce(func.max(ModuleStructureNode.order_index), -1)).where(parent_id_clause)
            )
            max_order = max_order_result.scalar()
            node_in.order_index = max_order + 1
            
        # 首先为模块创建权限记录
        page_path = f"/module-content/"  # 完整路径会在模块创建后更新
        
        # 如果有父模块，查找父模块对应的权限记录
        permission_parent_id = None
        parent_node = None
        if node_in.parent_id:
            # 查询父模块
            parent_result = await db.execute(
                select(ModuleStructureNode).where(ModuleStructureNode.id == node_in.parent_id)
            )
            parent_node = parent_result.scalar_one_or_none()
            if parent_node and parent_node.permission_id:
                # 设置权限记录的parent_id为父模块的权限ID
                permission_parent_id = parent_node.permission_id
        
        # 创建一个临时唯一code，避免初始插入时的code冲突
        import uuid
        temp_code = f"module:temp_{uuid.uuid4().hex[:8]}"
        
        db_permission = Permission(
            code=temp_code,  # 使用临时code
            name=f"{node_in.name}",
            page_path=page_path,
            is_visible=True,
            description=f"访问用户自定义模块: {node_in.name}",
            parent_id=permission_parent_id  # 设置权限的父级ID
        )
        
        db.add(db_permission)
        await db.flush()  # 获取权限记录ID，但不提交事务
        
        # 确保权限记录已分配ID
        await db.refresh(db_permission)

        # 创建新节点
        db_node = ModuleStructureNode(
            name=node_in.name,
            parent_id=node_in.parent_id,
            order_index=node_in.order_index,
            user_id=current_user.id,
            is_content_page=node_in.is_content_page,
            permission_id=db_permission.id  # 关联权限记录
        )

        db.add(db_node)
        await db.flush()  # 获取节点ID，但不提交事务
        await db.refresh(db_node)
        
        # 更新权限记录中的页面路径
        db_permission.page_path = f"/module-content/{db_node.id}"
        db_permission.code = f"module:{db_node.id}"
        
        # 如果是内容页面类型，自动创建一个空的内容记录
        has_content = False
        if db_node.is_content_page:
            # 创建新的内容记录
            db_content = ModuleContent(
                module_node_id=db_node.id,
                user_id=current_user.id,
                overview_text="",
                details_text="",
                database_tables_json=[],
                related_module_ids_json=[],
                api_interfaces_json=[]
            )
            db.add(db_content)
            has_content = True
        
        # 将新节点的权限分配给有权访问父节点的角色
        if parent_node and parent_node.permission_id:
            # 查询所有拥有父节点权限的角色
            parent_permission_id = parent_node.permission_id
            
            # 查询拥有父节点权限的所有角色
            stmt = select(Role).join(
                role_permission,
                Role.id == role_permission.c.role_id
            ).where(
                role_permission.c.permission_id == parent_permission_id
            )
            
            result = await db.execute(stmt)
            roles_with_parent_permission = result.scalars().all()
            
            # 将新权限分配给这些角色
            for role in roles_with_parent_permission:
                # 使用db.run_sync包装角色权限更新的整个逻辑，避免在异步上下文中同步访问属性
                async def update_role_permissions(role_obj, new_permission):
                    def _sync_update(session):
                        # 获取角色当前的权限
                        role_permissions = list(role_obj.permissions)
                        # 添加新权限
                        role_permissions.append(new_permission)
                        # 更新角色权限
                        setattr(role_obj, 'permissions', role_permissions)
                        return role_obj.name  # 返回角色名称用于日志
                    
                    role_name = await db.run_sync(_sync_update)
                    return role_name
                
                role_name = await update_role_permissions(role, db_permission)
                logger.info(f"权限继承: 已将权限 '{db_permission.code}' 从父节点 '{parent_node.name}' 继承并分配给角色 '{role_name}'")
        
        # 提交所有更改
        await db.commit()
        await db.refresh(db_node)
        await db.refresh(db_permission)

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
            "has_content": has_content,  # 如果创建了内容，则设置为True
            "permission_id": db_node.permission_id  # 在响应中包含权限ID
        }
        
        return success_response(data=response_dict, message="模块节点创建成功")
    except Exception as e:
        logger.error(f"创建模块节点失败: {str(e)}")
        return error_response(message=f"创建模块节点失败: {str(e)}")


@router.get("/", response_model=APIResponse[ModuleTreeResponse])
async def read_module_tree(
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)],
        parent_id: Optional[int] = None
):
    """
    获取模块结构树
    如果指定了parent_id，则只返回该节点的子树
    否则返回所有顶级节点及其子树
    """
    try:
        # 查询条件：如果指定了parent_id，则只查询该节点的子节点；否则查询所有顶级节点
        parent_condition = ModuleStructureNode.parent_id == parent_id if parent_id else ModuleStructureNode.parent_id.is_(None)

        # 获取所有节点（不分层）
        all_nodes_query = select(ModuleStructureNode).order_by(ModuleStructureNode.order_index)
        all_nodes_result = await db.execute(all_nodes_query)
        all_nodes = all_nodes_result.scalars().all()

        # 获取有内容的模块ID列表
        has_content_query = select(ModuleContent.module_node_id)
        has_content_result = await db.execute(has_content_query)
        has_content_ids = set(has_content_result.scalars().all())

        # 构建节点映射 {node_id: node_obj}
        nodes_by_id = {}
        for node in all_nodes:
            # 首先将SQLAlchemy对象转换为字典
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
                "has_content": node.id in has_content_ids
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

        return success_response(data={"items": root_nodes})
    except Exception as e:
        logger.error(f"获取模块结构树失败: {str(e)}")
        return error_response(message=f"获取模块结构树失败: {str(e)}")


@router.get("/{node_id}", response_model=APIResponse[ModuleStructureNodeResponse])
async def read_module_node(
        node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定模块节点的详细信息
    """
    try:
        # 查询节点
        result = await db.execute(
            select(ModuleStructureNode).where(ModuleStructureNode.id == node_id)
        )
        node = result.scalar_one_or_none()

        if not node:
            return error_response(message="模块节点不存在")

        # 查询是否有内容
        has_content_result = await db.execute(
            select(exists().where(ModuleContent.module_node_id == node_id))
        )
        has_content = has_content_result.scalar()

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

        return success_response(data=response_dict)
    except Exception as e:
        logger.error(f"获取模块节点详情失败: {str(e)}")
        return error_response(message=f"获取模块节点详情失败: {str(e)}")


@router.post("/update/{node_id}", response_model=APIResponse[ModuleStructureNodeResponse])
async def update_module_node(
        node_id: int,
        node_in: ModuleStructureNodeUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新模块结构节点
    """
    try:
        # 查询节点
        result = await db.execute(
            select(ModuleStructureNode).where(ModuleStructureNode.id == node_id)
        )
        node = result.scalar_one_or_none()

        if not node:
            return error_response(message="模块节点不存在")

        # 如果更新了名称，检查同一父节点下是否已存在同名节点
        if node_in.name and node_in.name != node.name:
            if node.parent_id is not None:
                # 如果有父节点，检查同一父节点下是否有同名节点
                name_exists_query = select(ModuleStructureNode).where(
                    ModuleStructureNode.name == node_in.name,
                    ModuleStructureNode.parent_id == node.parent_id,
                    ModuleStructureNode.id != node_id
                )
            else:
                # 如果是顶级节点，检查顶级节点中是否有同名节点
                name_exists_query = select(ModuleStructureNode).where(
                    ModuleStructureNode.name == node_in.name,
                    ModuleStructureNode.parent_id.is_(None),
                    ModuleStructureNode.id != node_id
                )
            
            name_exists_result = await db.execute(name_exists_query)
            if name_exists_result.first() is not None:
                return error_response(message="同一级别下已存在同名节点")

        # 如果更新了父节点，验证新父节点的存在性
        if node_in.parent_id is not None and node_in.parent_id != node.parent_id:
            # 检查新父节点是否存在
            parent_exists = await db.execute(
                select(exists().where(ModuleStructureNode.id == node_in.parent_id))
            )
            if not parent_exists.scalar():
                return error_response(message="父节点不存在")

            # 检查是否将节点移动到其子节点下（避免循环引用）
            async def get_all_child_ids(parent_id):
                result = await db.execute(
                    select(ModuleStructureNode.id).where(ModuleStructureNode.parent_id == parent_id)
                )
                child_ids = result.scalars().all()
                all_child_ids = set(child_ids)
                for child_id in child_ids:
                    all_child_ids.update(await get_all_child_ids(child_id))
                return all_child_ids

            child_ids = await get_all_child_ids(node_id)
            if node_in.parent_id in child_ids:
                return error_response(message="不能将节点移动到其子节点下")

        # 更新节点信息
        update_data = node_in.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(node, key, value)

        # 如果更新了名称，同时更新对应的权限记录
        if node_in.name and node.permission_id:
            permission_result = await db.execute(
                select(Permission).where(Permission.id == node.permission_id)
            )
            permission = permission_result.scalar_one_or_none()
            if permission:
                permission.name = node_in.name
                permission.description = f"访问用户自定义模块: {node_in.name}"

        await db.commit()
        await db.refresh(node)

        # 查询是否有内容
        has_content_result = await db.execute(
            select(exists().where(ModuleContent.module_node_id == node_id))
        )
        has_content = has_content_result.scalar()

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

        return success_response(data=response_dict, message="模块节点更新成功")
    except Exception as e:
        logger.error(f"更新模块节点失败: {str(e)}")
        return error_response(message=f"更新模块节点失败: {str(e)}")


@router.post("/delete/{node_id}", response_model=APIResponse)
async def delete_module_node(
        node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除模块结构节点及其所有子节点
    """
    try:
        # 查询节点
        result = await db.execute(
            select(ModuleStructureNode).where(ModuleStructureNode.id == node_id)
        )
        node = result.scalar_one_or_none()

        if not node:
            return error_response(message="模块节点不存在")

        # 递归删除节点及其所有子节点
        async def delete_node_recursive(node_id):
            # 获取所有子节点
            children_result = await db.execute(
                select(ModuleStructureNode).where(ModuleStructureNode.parent_id == node_id)
            )
            children = children_result.scalars().all()
            
            # 对每个子节点递归删除
            for child in children:
                await delete_node_recursive(child.id)
            
            # 在删除完所有子节点后，删除该节点的关联内容和权限
            # 删除关联的内容记录
            content_result = await db.execute(
                select(ModuleContent).where(ModuleContent.module_node_id == node_id)
            )
            content = content_result.scalar_one_or_none()
            if content:
                await db.delete(content)
            
            # 删除关联的权限记录
            node_result = await db.execute(
                select(ModuleStructureNode).where(ModuleStructureNode.id == node_id)
            )
            current_node = node_result.scalar_one_or_none()
            if current_node and current_node.permission_id:
                permission_result = await db.execute(
                    select(Permission).where(Permission.id == current_node.permission_id)
                )
                permission = permission_result.scalar_one_or_none()
                if permission:
                    await db.delete(permission)
            
            # 删除节点本身
            if current_node:
                await db.delete(current_node)
            
            # 记录日志
            logger.info(f"已删除节点: {node_id}")

        # 开始递归删除
        await delete_node_recursive(node_id)
        
        # 提交事务
        await db.commit()

        return success_response(message="模块节点及其所有子节点删除成功")
    except Exception as e:
        # 回滚事务
        await db.rollback()
        logger.error(f"删除模块节点失败: {str(e)}")
        return error_response(message=f"删除模块节点失败: {str(e)}") 