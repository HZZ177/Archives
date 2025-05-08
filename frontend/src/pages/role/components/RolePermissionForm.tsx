import React, { useState, useEffect, useRef } from 'react';
import { Modal, Tree, Button, Space, Spin, message, Tooltip, Tag, Typography } from 'antd';
import { LinkOutlined, AppstoreOutlined } from '@ant-design/icons';
import { fetchPermissionTree } from '../../../apis/permissionService';
import { fetchRolePermissions, assignPermissionsToRole } from '../../../apis/roleService';
import { PermissionTree } from '../../../types/permission';
import type { TreeProps } from 'antd';

const { Title } = Typography;

// 特殊的分隔线Key，确保不会与实际权限ID冲突
const DIVIDER_KEY = 'module_divider';

interface RolePermissionFormProps {
  roleId: number;
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const RolePermissionForm: React.FC<RolePermissionFormProps> = ({
  roleId,
  open,
  onCancel,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [permissions, setPermissions] = useState<PermissionTree[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [systemTreeData, setSystemTreeData] = useState<any[]>([]);
  const [moduleTreeData, setModuleTreeData] = useState<any[]>([]);
  
  // useRef来标记是否已经加载过数据，避免重复加载
  const dataLoadedRef = useRef(false);

  // 获取所有数据（权限树和角色权限）
  const loadAllData = async () => {
    if (dataLoadedRef.current) return;
    
    try {
      setLoading(true);
      
      // 获取权限树
      const permissionsData = await fetchPermissionTree();
      console.log('权限树数据:', permissionsData);
      setPermissions(permissionsData);
      
      // 分离系统权限和模块权限
      const systemPermissions: PermissionTree[] = [];
      const modulePermissions: PermissionTree[] = [];
      
      // 记录首页权限ID
      let homePagePermissionId: string | null = null;
      
      permissionsData.forEach(permission => {
        // 检查是否为首页权限
        if (permission.code === 'dashboard') {
          homePagePermissionId = permission.id.toString();
        }
        
        // 通过code判断是否为模块权限（以'module:'开头）
        if (permission.code && permission.code.startsWith('module:')) {
          modulePermissions.push(permission);
        } else {
          systemPermissions.push(permission);
        }
      });
      
      // 渲染系统权限树和模块权限树
      const renderedSystemTreeData = renderPermissionTree(systemPermissions);
      const renderedModuleTreeData = renderPermissionTree(modulePermissions);
      
      setSystemTreeData(renderedSystemTreeData);
      setModuleTreeData(renderedModuleTreeData);
      
      // 记录所有树节点的key，用于调试
      const allKeys: string[] = [];
      const extractKeys = (nodes: any[]) => {
        nodes.forEach(node => {
          allKeys.push(node.key);
          if (node.children) {
            extractKeys(node.children);
          }
        });
      };
      
      extractKeys([...renderedSystemTreeData, ...renderedModuleTreeData]);
      console.log('树中所有节点的key:', allKeys);
      
      // 获取角色权限
      const permissionIds = await fetchRolePermissions(roleId);
      console.log('角色当前权限IDs:', permissionIds);
      
      // 将数字ID转换为字符串ID以匹配Tree组件要求
      let stringIds = permissionIds.map(id => id.toString());
      
      // 确保首页权限始终被勾选
      if (homePagePermissionId && !stringIds.includes(homePagePermissionId)) {
        stringIds.push(homePagePermissionId);
      }
      
      console.log('设置勾选keys:', stringIds);
      
      // 检查树节点key是否存在于勾选列表中
      console.log('勾选的key是否在树中:',
        stringIds.map(id => `${id}: ${allKeys.includes(id)}`).join(', ')
      );
      
      setCheckedKeys(stringIds);
      
      // 标记数据已加载
      dataLoadedRef.current = true;
      setLoading(false);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
      setLoading(false);
    }
  };

  // 当modal打开或roleId变化时加载数据
  useEffect(() => {
    if (open && roleId) {
      dataLoadedRef.current = false; // 每次重新打开都重新加载
      loadAllData();
    }
  }, [open, roleId]);

  // 处理权限选择变更
  const handleCheck: TreeProps['onCheck'] = (checked, info) => {
    console.log('树选择变更:', checked);
    console.log('节点信息:', info);
    
    // 检查节点来自哪棵树
    // 通过检查当前点击节点的key是否在系统树中来判断
    const nodeKey = info.node.key.toString();
    const isSystemTree = systemTreeData.some(
      node => nodeKey === node.key.toString() || isChildOf(node, nodeKey)
    );
    
    // 获取当前选择树中的所有节点key
    const currentTreeKeys = isSystemTree ? getTreeKeys(systemTreeData) : getTreeKeys(moduleTreeData);
    
    // 从checkedKeys中过滤掉当前树的key，保留另一棵树的选择状态
    const otherTreeCheckedKeys = checkedKeys.filter(key => !currentTreeKeys.includes(key.toString()));
    
    // 合并另一棵树的选择状态和当前的选择状态
    const mergedCheckedKeys = [
      ...otherTreeCheckedKeys,
      ...(Array.isArray(checked) ? checked : checked.checked)
    ];
    
    // 确保首页权限节点(dashboard)始终被选中
    const homePageNode = findHomePageNode([...systemTreeData, ...moduleTreeData]);
    if (homePageNode && !mergedCheckedKeys.includes(homePageNode.key)) {
      mergedCheckedKeys.push(homePageNode.key);
    }
    
    setCheckedKeys(mergedCheckedKeys);
  };
  
  // 查找首页权限节点
  const findHomePageNode = (treeData: any[]): any | null => {
    for (const node of treeData) {
      if (node.code === 'dashboard') {
        return node;
      }
      if (node.children) {
        const found = findHomePageNode(node.children);
        if (found) return found;
      }
    }
    return null;
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

  // 提交权限分配
  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // 获取所有被选中且有页面路径的节点ID
      const getSelectedPermissionIds = (): number[] => {
        const selectedIds: number[] = [];
        const processTreeData = (treeData: any[]) => {
          treeData.forEach((node) => {
            if (
              checkedKeys.includes(node.key) && 
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
        
        // 确保首页权限ID被包含在内
        const homePagePermissionId = findHomePagePermissionId([...systemTreeData, ...moduleTreeData]);
        if (homePagePermissionId && !selectedIds.includes(homePagePermissionId)) {
          selectedIds.push(homePagePermissionId);
        }
        
        return selectedIds;
      };
      
      // 获取有效的权限ID列表
      const permissionIds = getSelectedPermissionIds();
      console.log('提交的权限IDs:', permissionIds);
      
      if (permissionIds.length === 0) {
        // 如果没有选中任何有效权限，警告用户
        message.warning('未选择任何有效页面权限');
      }
      
      await assignPermissionsToRole(roleId, permissionIds);
      message.success('权限分配成功');
      onSuccess();
      setSubmitting(false);
    } catch (error) {
      console.error('权限分配失败:', error);
      message.error('权限分配失败');
      setSubmitting(false);
    }
  };
  
  // 从权限树中查找首页权限ID
  const findHomePagePermissionId = (treeData: any[]): number | null => {
    for (const node of treeData) {
      if (node.code === 'dashboard') {
        return Number(node.key);
      }
      if (node.children) {
        const found = findHomePagePermissionId(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  // 渲染权限树节点
  const renderPermissionTree = (permissionList: PermissionTree[]): any[] => {
    return permissionList.map(item => {
      // 判断是否为首页权限节点（code为dashboard）
      const isHomePage = item.code === 'dashboard';
      
      // 确保key是字符串类型，与checkedKeys保持一致
      const node = {
        title: (
          <Space>
            {(!item.page_path || item.page_path.trim() === '') ? <AppstoreOutlined /> : <LinkOutlined />}
            <span>{item.name}</span>
            {item.page_path && item.page_path.trim() !== '' && (
              <Tooltip title={`页面路径: ${item.page_path}`}>
                <Tag color="green">{item.page_path}</Tag>
              </Tooltip>
            )}
            {isHomePage && (
              <Tooltip title="首页权限必须启用，无法禁用">
                <Tag color="blue">必选</Tag>
              </Tooltip>
            )}
          </Space>
        ),
        key: item.id.toString(), // 确保key是字符串类型
        page_path: item.page_path, // 保存页面路径供勾选逻辑使用
        children: item.children?.length ? renderPermissionTree(item.children) : undefined,
        // 如果是首页权限，则禁用该节点的勾选框
        disableCheckbox: isHomePage,
        // 首页权限节点是否勾选的计算逻辑不变，由checkedKeys控制
      };
      
      return node;
    });
  };

  return (
    <Modal
      title="分配页面访问权限"
      open={open}
      width={600}
      onCancel={onCancel}
      footer={[
        <Button key="back" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
        >
          保存
        </Button>,
      ]}
      maskClosable={false}
    >
      <div style={{ marginBottom: 16 }}>
        <p>请勾选角色可访问的页面。父级节点仅作为分组，勾选父级会自动选择所有子页面。</p>
      </div>
      <Spin spinning={loading}>
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {/* 系统模块权限树 */}
          {systemTreeData.length > 0 && (
            <Tree
              checkable
              checkStrictly={false}
              defaultExpandAll
              checkedKeys={checkedKeys}
              onCheck={handleCheck}
              treeData={systemTreeData}
            />
          )}
          
          {/* 自定义模块标题和权限树 */}
          {moduleTreeData.length > 0 && (
            <>
              <div style={{ margin: '10px 0', height: '1px', background: '#e8e8e8' }} />
              <Tree
                checkable
                checkStrictly={false}
                defaultExpandAll
                checkedKeys={checkedKeys}
                onCheck={handleCheck}
                treeData={moduleTreeData}
              />
            </>
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default RolePermissionForm; 