from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, exists, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api.deps import get_current_active_user, get_db
from backend.app.models.module_structure import ModuleStructureNode
from backend.app.models.module_content import ModuleContent
from backend.app.models.user import User
from backend.app.models.permission import Permission
from backend.app.schemas.module_structure import (
    ModuleStructureNodeCreate,
    ModuleStructureNodeResponse,
    ModuleStructureNodeUpdate,
    ModuleTreeResponse
)

router = APIRouter()


@router.post("/", response_model=ModuleStructureNodeResponse, status_code=status.HTTP_201_CREATED)
async def create_module_node(
        node_in: ModuleStructureNodeCreate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    创建模块结构节点
    """
    # 如果指定了父节点，验证其存在性
    if node_in.parent_id:
        parent_exists = await db.execute(
            select(exists().where(ModuleStructureNode.id == node_in.parent_id))
        )
        if not parent_exists.scalar():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父节点不存在"
            )

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
    if node_in.parent_id:
        # 查询父模块
        parent_node = await db.get(ModuleStructureNode, node_in.parent_id)
        if parent_node and parent_node.permission_id:
            # 设置权限记录的parent_id为父模块的权限ID
            permission_parent_id = parent_node.permission_id
    
    db_permission = Permission(
        code=f"module:{node_in.name.lower().replace(' ', '_')}",
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
    
    return response_dict


@router.get("/", response_model=ModuleTreeResponse)
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
        if parent_id:
            # 如果指定了parent_id，则加入所有子节点
            if node_dict["parent_id"] == parent_id:
                root_nodes.append(node_dict)
        else:
            # 否则只加入顶级节点
            if node_dict["parent_id"] is None:
                root_nodes.append(node_dict)

        # 将子节点添加到其父节点的children列表中
        if node_dict["parent_id"] and node_dict["parent_id"] in nodes_by_id:
            parent = nodes_by_id[node_dict["parent_id"]]
            parent["children"].append(node_dict)

    # 按order_index排序子节点
    for node_dict in nodes_by_id.values():
        node_dict["children"].sort(key=lambda x: x["order_index"])

    return {"items": root_nodes}


@router.get("/{node_id}", response_model=ModuleStructureNodeResponse)
async def read_module_node(
        node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    获取特定模块节点信息
    """
    node = await db.get(ModuleStructureNode, node_id)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模块节点不存在"
        )

    # 查询是否有内容
    has_content_query = select(exists().where(ModuleContent.module_node_id == node_id))
    has_content_result = await db.execute(has_content_query)
    has_content = has_content_result.scalar()

    # 查询子节点
    children_query = select(ModuleStructureNode).where(ModuleStructureNode.parent_id == node_id).order_by(ModuleStructureNode.order_index)
    children_result = await db.execute(children_query)
    children = children_result.scalars().all()

    # 构建响应：手动转换SQLAlchemy对象为字典
    children_list = []
    for child in children:
        child_dict = {
            "id": child.id,
            "name": child.name,
            "parent_id": child.parent_id,
            "order_index": child.order_index,
            "user_id": child.user_id,
            "is_content_page": child.is_content_page,
            "created_at": child.created_at,
            "updated_at": child.updated_at,
            "children": [],
            "has_content": False  # 此处简化处理，不查询子节点的内容状态
        }
        children_list.append(child_dict)

    # 构建主节点响应
    response_dict = {
        "id": node.id,
        "name": node.name,
        "parent_id": node.parent_id,
        "order_index": node.order_index,
        "user_id": node.user_id,
        "is_content_page": node.is_content_page,
        "created_at": node.created_at,
        "updated_at": node.updated_at,
        "children": children_list,
        "has_content": has_content
    }
    
    return response_dict


@router.put("/{node_id}", response_model=ModuleStructureNodeResponse)
async def update_module_node(
        node_id: int,
        node_in: ModuleStructureNodeUpdate,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    更新模块节点信息
    """
    node = await db.get(ModuleStructureNode, node_id)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模块节点不存在"
        )

    # 验证父节点存在性
    if node_in.parent_id is not None and node_in.parent_id != node.parent_id:
        # 不能将节点设为自己的子节点
        if node_in.parent_id == node_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能将节点设为自己的子节点"
            )

        parent_exists = await db.execute(
            select(exists().where(ModuleStructureNode.id == node_in.parent_id))
        )
        if not parent_exists.scalar():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父节点不存在"
            )

    # 更新节点
    update_data = node_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(node, key, value)
    
    # 如果模块名称更新了，同时更新其关联的权限记录
    if node.permission_id:
        permission = await db.get(Permission, node.permission_id)
        if permission:
            # 更新名称
            if "name" in update_data:
                permission.name = f"模块: {node.name}"
                permission.description = f"访问用户自定义模块: {node.name}"
            
            # 更新parent_id，需要同步更新权限记录的parent_id
            if "parent_id" in update_data:
                # 查找新父模块对应的权限
                permission_parent_id = None
                if node.parent_id:
                    parent_node = await db.get(ModuleStructureNode, node.parent_id)
                    if parent_node and parent_node.permission_id:
                        permission_parent_id = parent_node.permission_id
                
                # 更新权限记录的parent_id
                permission.parent_id = permission_parent_id
    
    # 如果模块没有关联的权限记录，创建一个
    if not node.permission_id:
        # 找出权限的parent_id
        permission_parent_id = None
        if node.parent_id:
            parent_node = await db.get(ModuleStructureNode, node.parent_id)
            if parent_node and parent_node.permission_id:
                permission_parent_id = parent_node.permission_id
        
        # 创建权限记录
        db_permission = Permission(
            code=f"module:{node.id}",
            name=f"模块: {node.name}",
            page_path=f"/module-content/{node.id}",
            is_visible=True,
            description=f"访问用户自定义模块: {node.name}",
            parent_id=permission_parent_id
        )
        db.add(db_permission)
        await db.flush()
        await db.refresh(db_permission)
        
        # 更新模块的权限关联
        node.permission_id = db_permission.id

    await db.commit()
    await db.refresh(node)

    # 查询是否有内容
    has_content_query = select(exists().where(ModuleContent.module_node_id == node_id))
    has_content_result = await db.execute(has_content_query)
    has_content = has_content_result.scalar()

    # 构建响应：手动创建字典
    response_dict = {
        "id": node.id,
        "name": node.name,
        "parent_id": node.parent_id,
        "order_index": node.order_index,
        "user_id": node.user_id,
        "is_content_page": node.is_content_page,
        "created_at": node.created_at,
        "updated_at": node.updated_at,
        "children": [],  # 更新时不返回子节点
        "has_content": has_content,
        "permission_id": node.permission_id  # 在响应中包含权限ID
    }

    return response_dict


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module_node(
        node_id: int,
        db: Annotated[AsyncSession, Depends(get_db)],
        current_user: Annotated[User, Depends(get_current_active_user)]
):
    """
    删除模块节点及其所有子节点和内容
    """
    node = await db.get(ModuleStructureNode, node_id)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模块节点不存在"
        )

    # 获取所有子节点（递归）
    async def get_all_child_ids(parent_id):
        children_query = select(ModuleStructureNode.id).where(ModuleStructureNode.parent_id == parent_id)
        children_result = await db.execute(children_query)
        child_ids = children_result.scalars().all()
        
        all_ids = list(child_ids)
        for child_id in child_ids:
            all_ids.extend(await get_all_child_ids(child_id))
        
        return all_ids

    # 获取所有子节点ID
    child_ids = await get_all_child_ids(node_id)
    all_ids = [node_id] + child_ids

    # 删除相关内容和节点
    for id_to_delete in all_ids:
        # 获取节点信息
        node_to_delete = await db.get(ModuleStructureNode, id_to_delete)
        if node_to_delete:
            # 删除关联的权限记录
            if node_to_delete.permission_id:
                permission_to_delete = await db.get(Permission, node_to_delete.permission_id)
                if permission_to_delete:
                    await db.delete(permission_to_delete)
            
            # 删除节点（内容会通过级联删除自动处理）
            await db.delete(node_to_delete)

    await db.commit()

    return None 