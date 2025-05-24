# 资料管理系统

## 项目背景

本项目旨在构建一个内部资料管理系统，用于标准化数据录入框架，支持工作区多级管理、模块化文档管理和图片上传。通过该系统，企业内部人员可以自主填充内容，提高资料管理的规范性和效率。

## 项目目标

- 建立标准化的资料填充框架，允许企业内部人员自主填充内容。
- 支持资料的多模块化管理和内容编辑。
- 提供友好的用户界面和高效的编辑体验。
- 实现完善的用户、角色及权限管理体系。
- 支持工作区管理，实现资料的多级组织和权限隔离。
- (远期) 为后期RAG（Retrieval Augmented Generation）系统集成打下坚实的数据基础。

## 技术栈

- **前端**：React 18 + TypeScript + Ant Design 5.x
- **后端**：FastAPI + SQLAlchemy + SQLite

## 项目架构

本项目采用前后端分离架构，前端负责用户界面和交互，后端负责业务逻辑和数据处理。通过 RESTful API 进行通信，确保系统的可扩展性和维护性。

## 目录结构

```
Archives/
├── backend/              # 后端应用
│   ├── app/              # 应用代码
│   │   ├── api/          # API接口
│   │   │   ├── endpoints/  # API端点
│   │   │   └── deps.py     # 依赖项（认证等）
│   │   ├── core/         # 核心配置
│   │   ├── db/           # 数据库相关
│   │   ├── models/       # 数据模型
│   │   ├── schemas/      # Pydantic模型
│   │   ├── services/     # 业务逻辑服务 (新增)
│   │   ├── repositories/ # 数据访问层 (新增)
│   │   └── main.py       # 应用入口
│   ├── static/           # 静态文件
│   ├── uploads/          # 上传文件存储
│   ├── alembic/          # 数据库迁移
│   └── requirements.txt  # 依赖管理
├── frontend/             # 前端应用
│   ├── public/           # 静态资源
│   ├── src/              # 源代码
│   │   ├── apis/         # API请求
│   │   ├── assets/       # 静态资源
│   │   ├── components/   # 组件
│   │   │   ├── common/   # 基础通用组件
│   │   │   └── business/ # 业务通用组件
│   │   ├── config/       # 配置文件
│   │   ├── contexts/     # React Context
│   │   ├── hooks/        # 自定义Hooks
│   │   ├── layouts/      # 布局
│   │   ├── pages/        # 页面
│   │   │   ├── documents/        # 文档管理
│   │   │   ├── login/            # 登录页面
│   │   │   ├── module/           # 模块管理
│   │   │   ├── module-content/   # 模块内容
│   │   │   ├── permission/       # 权限管理
│   │   │   ├── role/             # 角色管理
│   │   │   ├── structure-management/ # 结构管理
│   │   │   ├── user/             # 用户管理
│   │   │   └── workspace/        # 工作区管理 (新增)
│   │   ├── router.tsx    # 路由配置
│   │   ├── styles/       # 样式
│   │   ├── types/        # TypeScript类型
│   │   ├── utils/        # 工具函数
│   │   ├── App.tsx       # 应用入口组件
│   │   └── main.tsx      # 入口文件
│   └── package.json      # 依赖管理
└── README.md             # 项目说明
```

## 详细代码结构

### 后端结构

#### 核心模块 (`backend/app/core/`)

- **`config.py`** - 应用配置，管理环境变量和全局设置
- **`security.py`** - 安全相关功能，包括JWT和密码哈希
- **`logger.py`** - 日志配置模块 (新增)

#### 数据库 (`backend/app/db/`)

- **`base.py`** - SQLAlchemy基类，为所有模型提供基础功能
- **`session.py`** - 数据库会话管理，提供异步数据库连接
- **`utils.py`** - 数据库工具函数，包括获取本地时间等 (新增)

#### 数据模型 (`backend/app/models/`)

- **`__init__.py`** - 模型初始化文件
- **`user.py`** - 用户模型 (含 `mobile`, `is_superuser`) 及角色模型 (`Role` 包含 `is_default`, `status` 字段，并关联权限)
- **`document.py`** - 文档、模板、部分 (含多种类型如 `OVERVIEW`, `FLOW`, `CONTENT`, `DATABASE`, `API`, `CODE`, `CUSTOM` via `SectionTypeEnum`)、图片和关系模型
- **`permission.py`** - 权限模型 (`Permission` 控制页面级访问，含 `code`, `name`, `page_path`, `icon`, `sort`, `parent_id` 等字段，支持层级结构) 及角色权限关联
- **`module_structure.py`** - 模块结构节点模型，用于构建层级模块结构树 (新增)
- **`module_content.py`** - 模块内容模型，存储模块的六个固定内容部分 (新增)
- **`workspace.py`** - 工作区模型，作为资料的顶级组织单元 (新增)

#### API接口 (`backend/app/api/`)

- **`deps.py`** - 依赖注入，提供认证和数据库会话依赖
- **`router.py`** - API路由器，汇总所有端点

##### API端点 (`backend/app/api/endpoints/`)

- **`__init__.py`** - 端点初始化文件
- **`auth.py`** - 认证相关接口（登录、获取用户信息）
- **`users.py`** - 用户管理接口（增删改查）
- **`documents.py`** - 文档管理接口（文档及部分的增删改查）
- **`templates.py`** - 模板管理接口（增删改查）
- **`images.py`** - 图片管理接口（上传、获取、删除）
- **`module_structures.py`** - 模块结构管理接口
- **`module_contents.py`** - 模块内容管理接口
- **`roles.py`** - 角色管理接口
- **`permissions.py`** - 权限管理接口
- **`workspaces.py`** - 工作区管理接口 (新增)

#### 服务层 (`backend/app/services/`) (新增)

- **`workspace_service.py`** - 工作区业务逻辑服务
- **`user_service.py`** - 用户业务逻辑服务
- **`module_service.py`** - 模块业务逻辑服务

#### 数据访问层 (`backend/app/repositories/`) (新增)

- **`base.py`** - 基础仓库类，提供通用CRUD操作
- **`workspace_repository.py`** - 工作区数据访问实现
- **`user_repository.py`** - 用户数据访问实现
- **`module_repository.py`** - 模块数据访问实现

#### Pydantic模型 (`backend/app/schemas/`)

- **`user.py`** - 用户和角色模型
- **`document.py`** - 文档、模板、部分、图片和关系模型
- **`workspace.py`** - 工作区数据模型 (新增)
- **`module.py`** - 模块结构和内容模型 (新增)
- **`response.py`** - 统一响应模型 (新增)

### 前端结构

#### 布局 (`frontend/src/layouts/`)

- **`MainLayout.tsx`** - 主应用布局，包含侧边栏和顶部导航
- **`AuthLayout.tsx`** - 认证相关页面布局

#### 页面 (`frontend/src/pages/`)

- **LoginPage** - 用户登录页面
- **HomePage** - 主页/仪表盘 (示例)
- **NoPermissionPage** - 无权限提示页面
- **UserList**, **UserDetail** - 用户列表及详情/编辑页面
- **RoleList** - 角色列表页面
- **PermissionList** - 权限列表页面
- **DocumentList**, **DocumentEdit** - 文档列表及编辑/新建页面
- **StructureManagementPage** - 模块结构管理页面
- **ModuleContentPage** - 模块内容填充页面
- **WorkspaceManagePage** - 工作区管理页面 (新增)，支持工作区的创建、编辑、删除和用户分配

#### 上下文管理 (`frontend/src/contexts/`)

- **`AuthContext.tsx`** - 用户认证状态管理
- **`WorkspaceContext.tsx`** - 工作区上下文管理 (新增)

#### 路由 (`frontend/src/router.tsx`)

- `router.tsx`    # 路由配置，使用React Router 6，支持代码分割和私有路由

#### API服务 (`frontend/src/apis/`)

- **`auth.ts`** - 认证API服务
- **`userService.ts`** - 用户管理API服务
- **`roleService.ts`** - 角色管理API服务
- **`permissionService.ts`** - 权限管理API服务
- **`document.ts`** - 文档管理API服务
- **`moduleService.ts`** - 模块管理API服务
- **`workspaceService.ts`** - 工作区管理API服务 (新增)

#### 组件 (`frontend/src/components/business/SectionModules`)

- `DiagramEditor.tsx` - 交互式流程图编辑器组件，基于 Excalidraw，支持 JSON 存储(`diagram_data`)、版本控制(`diagram_version`)、自定义 UIOptions（仅导出、保存、帮助）以及自定义缩放和预览功能。

## 功能模块

1. **用户、角色与权限管理** (原"用户认证与授权")
   - 用户登录认证 (JWT令牌管理)
   - 基于角色的访问控制 (RBAC): 
     - `User` (用户), `Role` (角色), `Permission` (权限) 模型协同工作。
     - 角色分配给用户，权限分配给角色。
   - 页面级权限控制: 
     - `Permission` 模型定义具体页面或操作的权限代码 (如 `user:create`, `document:edit`)。
     - 可控制前端菜单的动态显示和路由访问。
     - 支持权限的层级结构 (父子权限)。
   - 超级管理员 (`is_superuser`) 拥有所有权限。

2. **用户管理**
   - 用户信息CRUD (包括 `username`, `mobile`, `email`, `is_active`, `is_superuser` 等字段)
   - 用户角色分配
   - 用户默认工作区设置 (新增)

3. **工作区管理** (新增)
   - 工作区CRUD操作：创建、查询、更新、删除工作区
   - 工作区用户管理：将用户添加到工作区、从工作区移除用户、更新用户在工作区中的角色
   - 工作区默认设置：设置和切换默认工作区
   - 工作区权限隔离：用户只能查看和操作其所属工作区的资源
   - 工作区主题定制：支持设置工作区图标和主题色彩

4. **文档管理**
   - 文档创建、查询、更新、删除
   - 文档内容的模块化管理：每个文档可由多个"部分 (`Section`)"组成，每个部分可以有不同的类型 (`SectionTypeEnum`：如 `OVERVIEW`, `FLOW`, `CONTENT`, `DATABASE`, `API`, `CODE`, `CUSTOM`)，允许高度结构化和多样化的内容组织。
   - 文档间关联关系
   - 文档工作区归属 (新增)：文档属于特定的工作区

5. **模板管理**
   - 模板通过API提供创建、查询、更新、删除功能。
   - 主要用于在创建文档时提供结构化的起点，帮助用户快速建立符合规范的文档框架。
   - 独立的前端模板管理界面目前部分集成于文档创建流程或正在进一步规划完善中。

6. **模块化结构管理**
   - 允许管理员通过 `module_structures` API 定义标准化的文档模块/章节结构 (例如：项目背景、需求分析、系统设计、接口定义等)。
   - 用户随后可以通过 `module_contents` API 及对应的前端页面 (`StructureManagementPage`, `ModuleContentPage`) 填充这些预定义模块的内容。
   - 支持模块结构的树形层级设计，可灵活组织内容结构
   - 与工作区集成，模块结构可以绑定到特定工作区 (新增)
   - 旨在提高文档编写的规范性和一致性。

7. **模块内容管理** (新增详情)
   - 每个模块内容包含六个固定部分：功能概述、交互式逻辑图/流程图编辑器、功能详解、数据库表、关联模块、涉及接口
   - 支持交互式流程图编辑，集成 Excalidraw，可导入/导出 `diagram_data` JSON 并配合后端 `diagram_version` 进行版本控制
   - 提供 GET `/module_contents/{module_node_id}/diagram` 和 PUT `/module_contents/{module_node_id}/diagram` 接口，通过服务层统一处理 upsert 操作
   - 画布 UI 自定义，仅保留导出、保存和帮助按钮；禁用外部链接；支持自定义缩放和滚轮及快捷键交互
   - 支持富文本编辑，包括图表、代码块等多种内容格式
   - 记录内容的修改历史和最后编辑者

8. **图片管理**
   - 图片上传、存储和引用
   - 支持图片与文档部分关联
   - 支持在富文本编辑器中直接插入图片

## 数据模型关系

- **用户(User)** - 系统操作者，可以创建文档和模板，并被分配一个或多个角色。
  - 与 **角色(Role)**: 多对多关系 (`user_role` 关联表)。
  - 与 **工作区(Workspace)**: 多对多关系 (`workspace_user` 关联表)，用户可以属于多个工作区，并在每个工作区中有特定的访问级别 (新增)。
  - 拥有自己创建的 **工作区(Workspace)** (一对多，`created_by` 外键) (新增)。

- **角色(Role)** - 定义一组权限集合。一个角色可以包含多个权限，也可以被分配给多个用户。
  - 与 **权限(Permission)**: 多对多关系 (`role_permission` 关联表)。

- **权限(Permission)** - 定义对特定资源或操作的访问许可（例如页面访问、功能操作）。权限可以具有层级关系（通过 `parent_id` 实现父子权限）。

- **工作区(Workspace)** - 系统资源的顶级组织单元，可包含多个模块结构和文档 (新增)。
  - 与 **用户(User)**: 多对多关系 (`workspace_user` 关联表)，工作区包含多个用户，每个用户有特定的访问级别。
  - 与 **模块结构节点(ModuleStructureNode)**: 一对多关系，一个工作区可以包含多个模块结构节点。

- **模块结构节点(ModuleStructureNode)** - 定义资料的结构组织，形成树形结构 (新增)。
  - 与 **工作区(Workspace)**: 多对一关系，归属于特定工作区。
  - 与自身: 自引用关系，形成树形结构 (通过 `parent_id` 外键)。
  - 与 **模块内容(ModuleContent)**: 一对一关系，每个内容页面类型的节点有对应的内容。
  - 与 **权限(Permission)**: 多对一关系，可以关联特定权限控制访问。

- **模块内容(ModuleContent)** - 存储模块的具体内容 (新增)。
  - 与 **模块结构节点(ModuleStructureNode)**: 一对一关系，属于特定的结构节点。
  - 与 **用户(User)**: 多对一关系，记录最后编辑者。

- **文档(Document)** - 核心数据实体，包含多个部分 (`Section`)，属于一个用户 (`creator`)，可以选择性地基于一个模板 (`Template`) 创建。
  - (新增) 与 **工作区(Workspace)** 关联，归属于特定工作区。

- **模板(Template)** - 定义文档的结构框架，由用户创建，可用于快速生成具有统一格式的文档。

- **部分(Section)** - 文档的内容单元，具有特定类型 (`type`)，可以包含文本内容和图片 (`Image`)。

- **图片(Image)** - 存储图片信息，关联到文档和可选的特定部分。

- **关系(Relation)** - 定义文档之间的引用或关联关系 (例如，一个文档引用另一个文档)。

## 安装与运行

### 环境要求

- **后端**
  - Python 3.11+
  - Pip

- **前端**
  - Node.js 16+
  - npm 8+

### 后端

1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

2. 启动服务
```
运行 main.py即可
```

### 前端

1. 安装依赖
```bash
cd frontend
npm install
```

2. 启动开发服务器
```bash
npm run dev
```

## API文档

启动后端服务器后，可通过以下地址访问API文档：

- Swagger UI: `http://localhost:8000/api/v1/docs`
- ReDoc: `http://localhost:8000/api/v1/redoc`

## 开发规范

### 后端

1. 代码风格遵循PEP 8。
2. 推荐编写单元测试。
3. API接口设计注重路径语义，通过POST和GET请求实现操作，以路由的具体含义区分功能。
4. 使用类型注解。
5. 保持文档的更新。

### 前端

1. 所有组件推荐使用函数式组件及Hooks。
2. 使用TypeScript进行类型检查。
3. 使用ESLint和Prettier进行代码质量和风格控制。
4. 文件命名规范：
   - 组件文件：PascalCase (`MyComponent.tsx`)
   - 工具函数/Hooks/类型等：camelCase (`myUtils.ts`, `useMyHook.ts`, `myTypes.d.ts`)
5. 路由使用懒加载以提高性能。
6. 状态管理优先使用React Context API，复杂状态可考虑 Zustand 或 Redux Toolkit。
7. CSS方案推荐使用CSS Modules或Styled Components，并配合Ant Design的样式系统。


DeepWiki badge
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/HZZ177/Archives)