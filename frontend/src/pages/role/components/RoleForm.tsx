import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Switch, Tree, Button, Space, Spin, message, Typography, Card, Tooltip, Row, Col, Divider, Tabs } from 'antd';
import { fetchPermissionTree } from '../../../apis/permissionService';
import { PermissionTree } from '../../../types/permission';
import type { TreeProps } from 'antd';
import { Role } from '../../../types/role';
import { LockOutlined } from '@ant-design/icons';
import './RoleForm.less'; // 确保创建并引入样式文件

const { Title } = Typography;
const { TextArea } = Input;

// 获取节点树所有节点的keys（包括子节点）
const getNodeKeys = (nodes: any[]): string[] => {
  const keys: string[] = [];
  
  const collectKeys = (nodeList: any[]) => {
    nodeList.forEach(node => {
      if (node.key) {
        keys.push(node.key.toString());
      }
      if (node.children && node.children.length > 0) {
        collectKeys(node.children);
      }
    });
  };
  
  collectKeys(nodes);
  return keys;
};

// 辅助函数：获取节点的所有子节点key
const getNodeChildrenKeys = (node: any): string[] => {
  const keys: string[] = [];
  
  if (!node.children || node.children.length === 0) {
    return keys;
  }
  
  const extractKeys = (nodes: any[]) => {
    nodes.forEach(childNode => {
      if (childNode.key) {
        keys.push(childNode.key.toString());
      }
      
      if (childNode.children && childNode.children.length > 0) {
        extractKeys(childNode.children);
      }
    });
  };

  extractKeys(node.children);
  return keys;
};

interface WorkspaceTreeProps {
  workspace: WorkspaceGroup;
  globalCheckedKeys: React.Key[];
  onTreeCheck: (checked: React.Key[], info: any, sourceKey: string) => void;
}

// WorkspaceTree组件，封装Tree组件，实现独立状态管理
const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  workspace,
  globalCheckedKeys,
  onTreeCheck,
}) => {
  // 当前工作区所有节点的keys
  const workspaceNodeKeys = getNodeKeys(workspace.permissionNodes);
  
  // 过滤当前工作区相关的选中keys
  const filteredCheckedKeys = globalCheckedKeys
    .map(key => key.toString())
    .filter(key => workspaceNodeKeys.includes(key));
  
  // 处理当前工作区的选中事件
  const handleCheck: TreeProps['onCheck'] = (checked, info) => {
    // 将Tree组件的选中状态转换为数组
    const checkedArray = Array.isArray(checked) 
      ? checked 
      : checked.checked;
    
    // 调用父组件的处理函数，传递当前工作区的key
    onTreeCheck(checkedArray, info, workspace.key);
  };
  
  return (
    <Tree
      checkable
      checkedKeys={filteredCheckedKeys}
      onCheck={handleCheck}
      treeData={workspace.permissionNodes}
      defaultExpandAll
      className="permission-tree"
      height={180}
      key={`workspace-tree-${workspace.key}-${JSON.stringify(filteredCheckedKeys)}`}
    />
  );
};

interface RoleFormProps {
  role?: Role | null;
  onSubmit: (values: any) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  resetKey?: number;
}

// 首页权限标识，通过页面路径来识别
const HOME_PAGE_PATH = '/';

// 添加工作区分组结构接口定义
interface WorkspaceGroup {
  title: string;
  key: string;
  workspaceId: number;
  permissionNodes: any[]; // 存储该工作区下的权限节点
}

// SystemTree组件，封装系统权限树
interface SystemTreeProps {
  treeData: any[];
  globalCheckedKeys: React.Key[];
  onTreeCheck: (checked: React.Key[], info: any, sourceKey: string) => void;
}

const SystemTree: React.FC<SystemTreeProps> = ({
  treeData,
  globalCheckedKeys,
  onTreeCheck,
}) => {
  // 系统树所有节点的keys
  const systemNodeKeys = getNodeKeys(treeData);
  
  // 过滤只包含系统树节点的选中keys
  const filteredCheckedKeys = globalCheckedKeys
    .map(key => key.toString())
    .filter(key => systemNodeKeys.includes(key));
  
  // 处理系统权限树的选中事件
  const handleCheck: TreeProps['onCheck'] = (checked, info) => {
    // 将Tree组件的选中状态转换为数组
    const checkedArray = Array.isArray(checked) 
      ? checked 
      : checked.checked;
    
    // 调用父组件的处理函数
    onTreeCheck(checkedArray, info, 'system');
  };
  
  return (
    <Tree
      checkable
      checkedKeys={filteredCheckedKeys}
      onCheck={handleCheck}
      treeData={treeData}
      defaultExpandAll
      className="permission-tree"
      height={430}
      key={`system-tree-${JSON.stringify(filteredCheckedKeys)}`}
    />
  );
};

const RoleForm: React.FC<RoleFormProps> = ({
  role,
  onSubmit,
  onCancel,
  submitting,
  resetKey,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionTree[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [systemTreeData, setSystemTreeData] = useState<any[]>([]);
  const [moduleTreeData, setModuleTreeData] = useState<any[]>([]);
  const [homePagePermissionId, setHomePagePermissionId] = useState<string | null>(null);
  
  // 使用roleIdRef来跟踪当前编辑的角色ID，用于检测角色变化
  const roleIdRef = useRef<number | null>(null);

  // 获取权限树数据
  const loadPermissionData = async () => {
    // 记录当前角色ID
    const currentRoleId = role?.id || null;
    roleIdRef.current = currentRoleId;
    console.log('加载权限数据，角色ID:', currentRoleId);
    
    try {
      setLoading(true);
      
      // 获取权限树
      const permissionsData = await fetchPermissionTree();
      console.log('权限树数据:', permissionsData);
      setPermissions(permissionsData);
      
      // 分离系统权限和模块权限
      const systemPermissions: PermissionTree[] = [];
      const modulePermissions: PermissionTree[] = [];
      
      // 查找首页权限ID
      let homePageId: string | null = null;
      const findHomePagePermission = (perms: PermissionTree[]) => {
        for (const perm of perms) {
          if (perm.page_path === HOME_PAGE_PATH) {
            homePageId = perm.id.toString();
            return true;
          }
          if (perm.children && perm.children.length > 0) {
            if (findHomePagePermission(perm.children)) {
              return true;
            }
          }
        }
        return false;
      };
      
      permissionsData.forEach(permission => {
        // 通过code判断是否为模块权限（以'module:'开头）
        if (permission.code && permission.code.startsWith('module:')) {
          modulePermissions.push(permission);
        } else {
          systemPermissions.push(permission);
        }
      });
      
      // 查找首页权限
      findHomePagePermission([...systemPermissions, ...modulePermissions]);
      setHomePagePermissionId(homePageId);
      console.log('首页权限ID:', homePageId);
      
      // 渲染系统权限树
      const renderedSystemTreeData = renderPermissionTree(systemPermissions);
      
      // 按工作区分组渲染模块权限树
      const renderedModuleTreeData = renderModuleTreeByWorkspace(modulePermissions);
      
      setSystemTreeData(renderedSystemTreeData);
      setModuleTreeData(renderedModuleTreeData);
      
      // 如果是编辑模式，加载角色已有权限
      let initialCheckedKeys: string[] = [];
      if (role && role.permissions) {
        // 使用角色中的权限数据
        const rolePermissions = role.permissions.map(perm => perm.id) || [];
        initialCheckedKeys = rolePermissions.map(id => id.toString());
        console.log('角色已有权限IDs:', initialCheckedKeys);
      } else {
        console.log('创建新角色或角色无权限数据');
      }
      
      // 确保首页权限ID在选中列表中
      if (homePageId && !initialCheckedKeys.includes(homePageId)) {
        initialCheckedKeys.push(homePageId);
      }
      
      console.log('最终设置的checkedKeys:', initialCheckedKeys);
      setCheckedKeys(initialCheckedKeys);
      
      setLoading(false);
    } catch (error) {
      console.error('加载权限数据失败:', error);
      message.error('加载权限数据失败');
      setLoading(false);
    }
  };

  // 按工作区分组权限数据
  const renderModuleTreeByWorkspace = (modulePermissions: PermissionTree[]): WorkspaceGroup[] => {
    // 按工作区ID分组权限
    const workspaceGroups: Map<number, WorkspaceGroup> = new Map();
    const noWorkspaceGroup: any[] = [];
    
    // 首先按工作区分组所有模块权限
    modulePermissions.forEach(permission => {
      // 如果没有工作区ID，放入未分组列表
      if (!permission.workspace_id) {
        const permNode = renderPermissionNode(permission);
        noWorkspaceGroup.push(permNode);
        return;
      }
      
      // 如果有工作区信息，按工作区分组
      if (!workspaceGroups.has(permission.workspace_id)) {
        workspaceGroups.set(permission.workspace_id, {
          title: permission.workspace_name || `工作区 ${permission.workspace_id}`,
          key: `workspace-${permission.workspace_id}`,
          workspaceId: permission.workspace_id,
          permissionNodes: []
        });
      }
      
      const group = workspaceGroups.get(permission.workspace_id)!;
      const permNode = renderPermissionNode(permission);
      group.permissionNodes.push(permNode);
    });
    
    // 转换Map为数组
    const result: WorkspaceGroup[] = Array.from(workspaceGroups.values());
    
    // 如果有未分组的权限，添加一个"未分组"分类
    if (noWorkspaceGroup.length > 0) {
      result.push({
        title: '未分组模块',
        key: 'workspace-none',
        workspaceId: -1,
        permissionNodes: noWorkspaceGroup
      });
    }
    
    return result;
  };
  
  // 渲染单个权限节点
  const renderPermissionNode = (permission: PermissionTree): any => {
    const isHomePage = permission.page_path === HOME_PAGE_PATH;
    const node: any = {
      key: permission.id.toString(),
      title: isHomePage ? (
        <Tooltip title="首页权限为必选项，所有用户都需要首页权限">
          <span>
            {permission.name} <LockOutlined style={{ color: '#1890ff' }} />
          </span>
        </Tooltip>
      ) : permission.name,
      code: permission.code,
      page_path: permission.page_path,
      workspace_id: permission.workspace_id,
      workspace_name: permission.workspace_name,
      // 如果是首页权限，禁用复选框
      disableCheckbox: isHomePage,
      // 如果是首页权限，设置样式
      className: isHomePage ? 'home-page-permission' : '',
    };
    
    if (permission.children && permission.children.length > 0) {
      node.children = permission.children.map(child => renderPermissionNode(child));
    }
    
    return node;
  };

  // 渲染权限树
  const renderPermissionTree = (permissionList: PermissionTree[]): any[] => {
    return permissionList.map(permission => renderPermissionNode(permission));
  };

  // 组件加载和状态重置
  useEffect(() => {
    loadPermissionData();
    
    // 如果角色ID变更，重新加载数据
    return () => {
      console.log('RoleForm组件卸载');
    };
  }, [role?.id, resetKey]); // 依赖role?.id而不是整个role对象，以及resetKey
  
  // 当角色权限变化时，更新表单中的permission_ids字段
  useEffect(() => {
    if (role && role.permissions && checkedKeys.length > 0) {
      form.setFieldsValue({
        permission_ids: checkedKeys.map(key => Number(key))
      });
    }
  }, [checkedKeys, form, role]);

  // 当role属性变化时重新加载权限数据
  useEffect(() => {
    // 如果role变化，重新加载数据
    loadPermissionData();
    
    // 如果role不存在，清空选中状态（创建模式）
    if (!role) {
      setCheckedKeys([]);
      if (homePagePermissionId) {
        setCheckedKeys([homePagePermissionId]);
      }
    }
  }, [role?.id]); // 仅在role.id变化时触发

  // 添加新的useEffect，监听role变化并重置表单值
  useEffect(() => {
    // 当role发生变化时，重置表单字段值
    if (role) {
      form.setFieldsValue({
        name: role.name || '',
        description: role.description || '',
      });
    } else {
      // 如果是创建新角色，则重置为空值
      form.setFieldsValue({
        name: '',
        description: '',
      });
    }
  }, [role, form]); // 依赖role整个对象和form实例

  // 渲染工作区卡片
  const renderWorkspaceCards = (workspaceGroups: WorkspaceGroup[]) => {
    return (
      <Row gutter={[16, 16]} style={{ maxHeight: '100%', overflow: 'auto' }}>
        {workspaceGroups.map((workspace) => (
          <Col xs={24} sm={24} md={12} xl={8} key={workspace.key}>
            <Card 
              title={workspace.title} 
              bordered={true} 
              className="workspace-card"
              size="small"
              headStyle={{ background: '#f5f5f5', padding: '8px 12px' }}
              bodyStyle={{ padding: '12px', maxHeight: '220px', overflowY: 'auto' }}
            >
              <WorkspaceTree
                workspace={workspace}
                globalCheckedKeys={checkedKeys}
                onTreeCheck={(checked, info, sourceKey) => handleCheck(checked, info, sourceKey)}
              />
            </Card>
          </Col>
        ))}
      </Row>
    );
  };
  
  // 自定义类型扩展，支持额外参数
  type CustomOnCheckFn = (
    checked: { checked: React.Key[]; halfChecked: React.Key[] } | React.Key[],
    info: any,
    sourceKey?: string
  ) => void;

  // 处理权限选择
  const handleCheck: CustomOnCheckFn = (checked, info, sourceKey?: string) => {
    console.log('当前选择操作来源:', sourceKey || 'system');
    
    // 获取当前操作节点的key
    const nodeKey = info?.node?.key?.toString() || '';
    
    // 将传入的checked转换为字符串数组
    const currentChecked: string[] = Array.isArray(checked) 
      ? checked.map((key: React.Key) => key.toString())
      : checked.checked.map((key: React.Key) => key.toString());
      
    console.log(`节点 ${nodeKey} 状态变化, 当前树选中节点:`, currentChecked);
    
    // 创建全局选中状态的副本
    let newCheckedKeys = [...checkedKeys].map(key => key.toString());
    
    // 获取当前操作的树（系统树或特定工作区）的所有节点key
    const sourceTreeKeys = sourceKey === 'system' 
      ? getNodeKeys(systemTreeData)
      : moduleTreeData.find(ws => ws.key === sourceKey)
        ? getNodeKeys(moduleTreeData.find(ws => ws.key === sourceKey)!.permissionNodes)
        : [];
    
    if (sourceTreeKeys.length === 0) {
      console.warn('未找到源树的节点keys');
      return;
    }
    
    // 从全局选中状态中移除当前树的所有节点
    newCheckedKeys = newCheckedKeys.filter(key => !sourceTreeKeys.includes(key));
    
    // 将当前树的选中状态合并到全局状态
    newCheckedKeys = [...newCheckedKeys, ...currentChecked];
    
    // 确保首页权限ID始终在选中列表中
    if (homePagePermissionId && !newCheckedKeys.includes(homePagePermissionId)) {
      newCheckedKeys.push(homePagePermissionId);
    }
    
    console.log('更新后的选中列表:', newCheckedKeys);
    
    // 更新选中状态
    setCheckedKeys(newCheckedKeys);
    
    // 更新表单中的permission_ids字段
    form.setFieldsValue({ 
      permission_ids: newCheckedKeys.map(key => Number(key))
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        name: role?.name || '',
        description: role?.description || '',
        permission_ids: [],
      }}
      onFinish={async (values) => {
        await onSubmit(values);
      }}
    >
      <Spin spinning={loading}>
        <Row gutter={16}>
          {/* 左侧角色基本信息 */}
          <Col span={6}>
            <Card title="角色信息" className="role-info-card">
              <Form.Item
                name="name"
                label="角色名称"
                rules={[{ required: true, message: '请输入角色名称' }]}
              >
                <Input placeholder="请输入角色名称" />
              </Form.Item>
              
              <Form.Item
                name="description"
                label="角色描述"
              >
                <TextArea rows={4} placeholder="请输入角色描述" />
              </Form.Item>
            </Card>
          </Col>
          
          {/* 右侧权限分配 */}
          <Col span={18}>
            <Card 
              title="权限分配" 
              className="permissions-card"
              bodyStyle={{ 
                height: '500px', 
                overflowY: 'auto', 
                padding: '0',
              }}
            >
              <Form.Item
                name="permission_ids"
                rules={[{ required: true, message: '请选择至少一个权限' }]}
                noStyle
              >
                <div style={{ height: '100%' }}>
                  {/* 系统权限和模块权限使用Tabs组件切换 */}
                  <Tabs 
                    defaultActiveKey="system" 
                    style={{ height: '100%' }}
                    tabBarStyle={{ padding: '0 12px' }}
                    items={[
                    {
                      key: 'system',
                      label: '系统权限',
                      children: (
                        <div className="system-permissions" style={{ padding: '12px' }}>
                          <SystemTree
                            treeData={systemTreeData}
                            globalCheckedKeys={checkedKeys}
                            onTreeCheck={(checked, info) => handleCheck(checked, info, 'system')}
                          />
                        </div>
                      )
                    },
                    {
                      key: 'modules',
                      label: '模块权限',
                      children: (
                        <div className="module-permissions" style={{ padding: '12px' }}>
                          {renderWorkspaceCards(moduleTreeData)}
                        </div>
                      )
                    }
                  ]} />
                </div>
              </Form.Item>
            </Card>
          </Col>
        </Row>
        
        {/* 在表单底部添加按钮 */}
        <Row justify="end" style={{ marginTop: '20px' }}>
          <Col>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  保存
                </Button>
                <Button onClick={onCancel}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Col>
        </Row>
      </Spin>
    </Form>
  );
};

export default RoleForm; 