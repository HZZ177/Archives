import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Switch, Tree, Button, Space, Spin, message, Typography, Card, Tooltip, Row, Col } from 'antd';
import { fetchPermissionTree } from '../../../apis/permissionService';
import { PermissionTree } from '../../../types/permission';
import type { TreeProps } from 'antd';
import { Role } from '../../../types/role';
import { LockOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;

interface RoleFormProps {
  role?: Role | null;
  onSubmit: (values: any) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

// 首页权限标识，通过页面路径来识别
const HOME_PAGE_PATH = '/';

const RoleForm: React.FC<RoleFormProps> = ({
  role,
  onSubmit,
  onCancel,
  submitting,
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
      
      // 渲染系统权限树和模块权限树
      const renderedSystemTreeData = renderPermissionTree(systemPermissions);
      const renderedModuleTreeData = renderPermissionTree(modulePermissions);
      
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

  // 处理权限选择变更
  const handleCheck: TreeProps['onCheck'] = (checked: any, info: any) => {
    console.log('树选择变更:', checked);
    console.log('节点信息:', info);
    
    // 检查节点来自哪棵树
    const nodeKey = info.node.key.toString();
    const isSystemTree = systemTreeData.some(
      node => nodeKey === node.key.toString() || isChildOf(node, nodeKey)
    );
    
    // 获取当前选择树中的所有节点key
    const currentTreeKeys = isSystemTree ? getTreeKeys(systemTreeData) : getTreeKeys(moduleTreeData);
    
    // 从checkedKeys中过滤掉当前树的key，保留另一棵树的选择状态
    const otherTreeCheckedKeys = checkedKeys.filter(key => !currentTreeKeys.includes(key.toString()));
    
    // 合并另一棵树的选择状态和当前的选择状态
    let mergedCheckedKeys = [
      ...otherTreeCheckedKeys,
      ...(Array.isArray(checked) ? checked : checked.checked)
    ];
    
    // 确保首页权限始终被选中
    if (homePagePermissionId && !mergedCheckedKeys.includes(homePagePermissionId)) {
      mergedCheckedKeys.push(homePagePermissionId);
    }
    
    setCheckedKeys(mergedCheckedKeys);
  };
  
  // 辅助函数：检查一个key是否是某节点的子节点
  const isChildOf = (node: any, key: string): boolean => {
    if (!node.children) return false;
    
    return node.children.some((child: any) => 
      child.key.toString() === key || isChildOf(child, key)
    );
  };

  // 辅助函数：获取树中所有节点的key
  const getTreeKeys = (treeData: any[]): string[] => {
    const keys: string[] = [];
    const extractKeys = (nodes: any[]) => {
      nodes.forEach(node => {
        keys.push(node.key.toString());
        if (node.children) {
          extractKeys(node.children);
        }
      });
    };
    extractKeys(treeData);
    return keys;
  };

  // 渲染权限树
  const renderPermissionTree = (permissionList: PermissionTree[]): any[] => {
    return permissionList.map(permission => {
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
        // 如果是首页权限，禁用复选框
        disableCheckbox: isHomePage,
        // 如果是首页权限，设置样式
        className: isHomePage ? 'home-page-permission' : '',
      };
      
      if (permission.children && permission.children.length > 0) {
        node.children = renderPermissionTree(permission.children);
      }
      
      return node;
    });
  };

  // 获取选中的权限ID列表
  const getSelectedPermissionIds = (): number[] => {
    const selectedIds: number[] = [];
    const processTreeData = (treeData: any[]) => {
      treeData.forEach((node) => {
        if (
          (checkedKeys.includes(node.key) || 
          (homePagePermissionId && node.key === homePagePermissionId)) && 
          node.page_path && 
          node.page_path.trim() !== ''
        ) {
          selectedIds.push(Number(node.key));
        }
        
        if (node.children) {
          processTreeData(node.children);
        }
      });
    };

    processTreeData([...systemTreeData, ...moduleTreeData]);
    return selectedIds;
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 获取选中的权限ID
      const permissionIds = getSelectedPermissionIds();
      
      // 验证是否选择了权限
      if (permissionIds.length === 0) {
        message.warning('请至少选择一个权限');
        return;
      }
      
      // 合并表单数据和权限ID
      const submitData = {
        ...values,
        permission_ids: permissionIds
      };
      
      await onSubmit(submitData);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 重置权限选择状态
  const resetPermissions = () => {
    // 如果角色存在且有权限数据，重置为原始权限
    if (role && role.permissions) {
      const originalPermissions = role.permissions.map(perm => perm.id.toString());
      // 确保首页权限被选中
      const resetKeys = [...originalPermissions];
      if (homePagePermissionId && !resetKeys.includes(homePagePermissionId)) {
        resetKeys.push(homePagePermissionId);
      }
      setCheckedKeys(resetKeys);
    } else {
      // 如果是新角色，只保留首页权限
      setCheckedKeys(homePagePermissionId ? [homePagePermissionId] : []);
    }
    
    // 重置表单字段
    form.resetFields();
    if (role) {
      form.setFieldsValue({
        name: role.name || '',
        description: role.description || '',
      });
    }
  };
  
  // 处理取消按钮点击
  const handleCancel = () => {
    resetPermissions();
    onCancel();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      key={role?.id || 'new'}
      initialValues={{
        name: role?.name || '',
        description: role?.description || '',
      }}
    >
      <Row gutter={16}>
        <Col span={8}>
          <Card title="角色信息" style={{ height: '100%' }}>
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
              <TextArea rows={3} placeholder="请输入角色描述" />
            </Form.Item>
          </Card>
        </Col>
        
        <Col span={16}>
          <Card title="权限分配">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="加载权限数据中..." />
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text type="secondary">
                    注意：首页权限为必选项，所有用户都需要首页权限才能正常使用系统
                  </Typography.Text>
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Title level={5}>系统权限</Title>
                    <Tree
                      checkable
                      checkedKeys={checkedKeys}
                      onCheck={handleCheck}
                      treeData={systemTreeData}
                      height={300}
                      style={{ border: '1px solid #f0f0f0', padding: '8px', borderRadius: '4px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Title level={5}>自定义模块权限</Title>
                    <Tree
                      checkable
                      checkedKeys={checkedKeys}
                      onCheck={handleCheck}
                      treeData={moduleTreeData}
                      height={300}
                      style={{ border: '1px solid #f0f0f0', padding: '8px', borderRadius: '4px' }}
                    />
                  </Col>
                </Row>
              </>
            )}
          </Card>
        </Col>
      </Row>
      
      <Form.Item style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting}>
            {role ? '更新' : '创建'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default RoleForm; 