# 资料管理系统

内部资料管理系统，用于标准化数据录入框架，支持模块化文档管理和图片上传。

## 项目架构

本项目采用前后端分离架构：
- **前端**：React 18 + TypeScript + Ant Design 5.x
- **后端**：FastAPI + SQLAlchemy + SQLite

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
│   │   ├── router/       # 路由配置
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

#### 数据库 (`backend/app/db/`)

- **`base.py`** - SQLAlchemy基类，为所有模型提供基础功能
- **`session.py`** - 数据库会话管理，提供异步数据库连接

#### 数据模型 (`backend/app/models/`)

- **`__init__.py`** - 模型初始化文件
- **`user.py`** - 用户和角色模型
- **`document.py`** - 文档、模板、部分、图片和关系模型

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

#### Pydantic模型 (`backend/app/schemas/`)

- **`__init__.py`** - 模型初始化文件
- **`token.py`** - 令牌相关模型
- **`user.py`** - 用户相关请求和响应模型
- **`document.py`** - 文档相关请求和响应模型
- **`template.py`** - 模板相关请求和响应模型
- **`image.py`** - 图片相关请求和响应模型

#### 应用入口 (`backend/app/main.py`)

- 应用初始化、中间件配置、路由注册

### 前端结构

#### API请求 (`frontend/src/apis/`)

- 封装后端API调用，处理数据请求和响应

#### 组件 (`frontend/src/components/`)

- **公共组件** - 可复用的UI组件
  - **基础通用组件** - 基础UI元素
  - **业务通用组件** - 特定业务功能的组件

#### 上下文 (`frontend/src/contexts/`)

- 状态管理，主要用于用户认证和全局状态

#### 自定义Hooks (`frontend/src/hooks/`)

- 封装可复用的逻辑

#### 布局 (`frontend/src/layouts/`)

- **MainLayout** - 主布局组件，包含侧边栏和内容区
- **SideNav** - 侧边导航组件
- **Header** - 顶部导航和用户信息

#### 页面 (`frontend/src/pages/`)

- **LoginPage** - 用户登录页面
- **DocumentList** - 文档列表页面
- **DocumentEdit** - 文档编辑页面
- **TemplateList** - 模板列表页面
- **TemplateEdit** - 模板编辑页面

#### 路由 (`frontend/src/router/`)

- 路由配置，使用React Router 6，支持路由懒加载

#### 样式 (`frontend/src/styles/`)

- 全局样式和主题配置

#### 工具函数 (`frontend/src/utils/`)

- 常用工具函数和辅助方法

## 技术栈详情

### 后端

- **框架**: FastAPI
- **数据库**: SQLite
- **ORM**: SQLAlchemy
- **认证**: JWT (JSON Web Tokens)
- **文档**: OpenAPI (Swagger)
- **测试**: Pytest
- **部署**: Docker (可选)

### 前端

- **框架**: React 18
- **语言**: TypeScript
- **UI组件**: Ant Design 5.x
- **路由**: React Router 6
- **HTTP客户端**: Axios
- **状态管理**: React Context API
- **富文本编辑器**: Quill.js
- **构建工具**: Vite

## 功能模块

1. **用户认证与授权**
   - 登录认证
   - 基于角色的权限控制
   - JWT令牌管理

2. **用户管理**
   - 用户信息CRUD
   - 角色管理

3. **文档管理**
   - 文档创建、查询、更新、删除
   - 文档内容的模块化管理
   - 文档间关联关系

4. **模板管理**
   - 模板创建与应用
   - 结构化模板定义

5. **图片管理**
   - 图片上传
   - 图片与文档/部分关联
   - 图片显示与删除

6. **内容编辑**
   - 富文本编辑
   - 模块化内容组织
   - 内容版本管理

## 数据模型关系

- **用户(User)** - 拥有多个文档，可以有多个角色
- **角色(Role)** - 定义用户权限
- **文档(Document)** - 包含多个部分，属于一个用户，可以基于模板
- **模板(Template)** - 定义文档结构，由用户创建
- **部分(Section)** - 文档的内容单元，可以包含图片
- **图片(Image)** - 属于文档和部分
- **关系(Relation)** - 定义文档间的引用关系

## 安装与运行

### 环境要求

- **后端**
  - Python 3.8+
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

2. 设置环境变量

```bash
cp .env.example .env  # 编辑配置
```

3. 初始化数据库

```bash
alembic upgrade head  # 初始化数据库
```

4. 启动服务

```bash
uvicorn app.main:app --reload
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

3. 构建生产版本

```bash
npm run build
```

4. 预览生产构建

```bash
npm run preview
```

## API文档

启动后端服务器后，可通过以下地址访问API文档：

- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

## 开发规范

### 后端

1. 代码风格遵循PEP 8
2. 所有功能需要编写单元测试
3. API设计遵循RESTful原则
4. 使用类型注解
5. 保持文档的更新

### 前端

1. 所有组件使用函数式组件
2. 使用TypeScript进行类型检查
3. 使用ESLint进行代码质量控制
4. 文件命名规范：
   - 组件文件：PascalCase
   - 工具函数文件：camelCase
   - 类型定义文件：camelCase.d.ts
5. 路由使用懒加载以提高性能