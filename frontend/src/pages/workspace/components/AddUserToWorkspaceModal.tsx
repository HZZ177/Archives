import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Spin, Empty } from 'antd';
import { fetchUsers } from '../../../apis/userService';
import { User } from '../../../types/user';
import { WorkspaceUserParams } from '../../../types/workspace';

interface AddUserToWorkspaceModalProps {
  visible: boolean;
  workspaceId: number;
  workspaceName: string;
  existingUserIds: number[]; // 已在工作区中的用户ID列表
  onAdd: (params: WorkspaceUserParams) => Promise<void>;
  onCancel: () => void;
}

const AddUserToWorkspaceModal: React.FC<AddUserToWorkspaceModalProps> = ({
  visible,
  workspaceId,
  workspaceName,
  existingUserIds,
  onAdd,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 角色选项
  const roleOptions = [
    { value: 'owner', label: '所有者' },
    { value: 'admin', label: '管理员' },
    { value: 'member', label: '成员' },
    { value: 'guest', label: '访客' }
  ];

  // 获取用户列表
  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);
      const response = await fetchUsers();
      
      // 过滤掉已经在工作区中的用户
      const availableUsers = response.filter((user: User) => !existingUserIds.includes(user.id));
      setUsers(availableUsers);
      setLoading(false);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      setLoading(false);
    }
  };

  // 模态框显示时获取数据
  useEffect(() => {
    if (visible) {
      fetchAvailableUsers();
      form.resetFields();
    }
  }, [visible, form, existingUserIds]);

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      await onAdd({
        user_id: values.user_id,
        role: values.role
      });
      
      form.resetFields();
      setSubmitting(false);
    } catch (error) {
      console.error('表单验证或提交失败:', error);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`添加用户到 ${workspaceName}`}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
          disabled={users.length === 0}
        >
          添加
        </Button>
      ]}
      maskClosable={false}
    >
      <Spin spinning={loading}>
        {users.length === 0 ? (
          <Empty 
            description="没有可添加的用户" 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
          />
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item
              name="user_id"
              label="选择用户"
              rules={[{ required: true, message: '请选择用户' }]}
            >
              <Select
                placeholder="请选择用户"
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                options={users.map(user => ({
                  value: user.id,
                  label: `${user.username}${user.email ? ` (${user.email})` : ''}`
                }))}
              />
            </Form.Item>

            <Form.Item
              name="role"
              label="选择角色"
              initialValue="member"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select
                placeholder="请选择角色"
                options={roleOptions}
              />
            </Form.Item>
          </Form>
        )}
      </Spin>
    </Modal>
  );
};

export default AddUserToWorkspaceModal; 