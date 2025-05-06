import React, { useState, useEffect } from 'react';
import { Modal, Tree, Button, Space, Spin, message } from 'antd';
import { fetchPermissionTree } from '../../../apis/permissionService';
import { fetchRolePermissions, assignPermissionsToRole } from '../../../apis/roleService';
import { PermissionTree } from '../../../types/permission';

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
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);

  // 获取所有权限
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const data = await fetchPermissionTree();
      setPermissions(data);
      setLoading(false);
    } catch (error) {
      console.error('获取权限列表失败:', error);
      message.error('获取权限列表失败');
      setLoading(false);
    }
  };

  // 获取角色权限
  const fetchCurrentRolePermissions = async () => {
    try {
      setLoading(true);
      const permissionIds = await fetchRolePermissions(roleId);
      setRolePermissions(permissionIds);
      setCheckedKeys(permissionIds.map(id => id.toString()));
      setLoading(false);
    } catch (error) {
      console.error('获取角色权限失败:', error);
      message.error('获取角色权限失败');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && roleId) {
      fetchPermissions();
      fetchCurrentRolePermissions();
    }
  }, [open, roleId]);

  // 处理权限选择变更
  const handleCheck = (checked: React.Key[]) => {
    setCheckedKeys(checked);
  };

  // 提交权限分配
  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const permissionIds = checkedKeys.map(key => parseInt(key.toString(), 10));
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

  return (
    <Modal
      title="分配权限"
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
      <Spin spinning={loading}>
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {permissions.length > 0 && (
            <Tree
              checkable
              checkStrictly
              defaultExpandAll
              checkedKeys={checkedKeys}
              onCheck={(checked: any) => handleCheck(checked as React.Key[])}
              treeData={permissions.map(item => ({
                title: item.name,
                key: item.id,
                children: item.children?.map(child => ({
                  title: child.name,
                  key: child.id,
                  children: child.children?.map(subChild => ({
                    title: subChild.name,
                    key: subChild.id,
                  })),
                })),
              }))}
            />
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default RolePermissionForm; 