import React, { useState, useEffect, useRef } from 'react';
import { Modal, Tree, Button, Space, Spin, message, Tooltip, Tag } from 'antd';
import { LinkOutlined, AppstoreOutlined } from '@ant-design/icons';
import { fetchPermissionTree } from '../../../apis/permissionService';
import { fetchRolePermissions, assignPermissionsToRole } from '../../../apis/roleService';
import { PermissionTree } from '../../../types/permission';
import type { TreeProps } from 'antd';

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
  const [treeData, setTreeData] = useState<any[]>([]);
  
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
      
      // 渲染树数据，并输出所有节点的key
      const renderedTreeData = renderPermissionTree(permissionsData);
      setTreeData(renderedTreeData);
      
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
      extractKeys(renderedTreeData);
      console.log('树中所有节点的key:', allKeys);
      
      // 获取角色权限
      const permissionIds = await fetchRolePermissions(roleId);
      console.log('角色当前权限IDs:', permissionIds);
      
      // 将数字ID转换为字符串ID以匹配Tree组件要求
      const stringIds = permissionIds.map(id => id.toString());
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
    if (Array.isArray(checked)) {
      setCheckedKeys(checked);
    } else {
      setCheckedKeys(checked.checked);
    }
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

        processTreeData(treeData);
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

  // 渲染权限树节点
  const renderPermissionTree = (permissionList: PermissionTree[]): any[] => {
    return permissionList.map(item => {
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
          </Space>
        ),
        key: item.id.toString(), // 确保key是字符串类型
        page_path: item.page_path, // 保存页面路径供勾选逻辑使用
        children: item.children?.length ? renderPermissionTree(item.children) : undefined,
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
          {treeData.length > 0 && (
            <Tree
              checkable
              checkStrictly={false}
              defaultExpandAll
              checkedKeys={checkedKeys}
              onCheck={handleCheck}
              treeData={treeData}
            />
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default RolePermissionForm; 