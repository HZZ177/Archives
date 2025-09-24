import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Spin, Empty, message } from 'antd';
import { fetchUsers } from '../../../apis/userService';
import { User } from '../../../types/user';
import { WorkspaceUserParams, BatchAddUsersToWorkspaceRequest } from '../../../types/workspace';
import { roleOptions, roleToAccessLevel } from '../../../utils/roleMapping';

interface AddUserToWorkspaceModalProps {
  open: boolean;
  workspaceId: number;
  workspaceName: string;
  existingUserIds: number[]; // 已在工作区中的用户ID列表
  onAdd: (params: BatchAddUsersToWorkspaceRequest) => Promise<void>;
  onCancel: () => void;
}

const AddUserToWorkspaceModal: React.FC<AddUserToWorkspaceModalProps> = ({
  open,
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
      message.error('获取用户列表失败');
      setLoading(false);
    }
  };

  // 模态框显示时获取数据
  useEffect(() => {
    if (visible) {
      fetchAvailableUsers();
      // 确保每次弹窗打开时表单都被重置
      form.resetFields();
    }
  }, [visible, form, existingUserIds]);

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      const selectedUserIds = values.user_ids;
      const role = values.role;
      const accessLevel = roleToAccessLevel[role] || 'read';

      // 调用父组件的 onAdd 进行批量添加
      await onAdd({
        user_ids: selectedUserIds,
        access_level: accessLevel
      });
      
      // 成功后由父组件处理消息提示和关闭模态框
      // 这里只需要重置表单和提交状态
      form.resetFields();
      // onCancel(); // 父组件的 onAdd 成功后会调用 setAddUserModalVisible(false)
      // message.success(`成功添加 ${selectedUserIds.length} 个用户到工作区`); // 移至父组件

    } catch (errorInfo) { // Antd validateFields 失败会进入这里，或者 onAdd Promise reject
      // 如果是表单验证错误，Antd会自动显示
      // 如果是 onAdd 抛出的错误, 父组件应该已经处理了 message.error
      console.error('模态框提交或onAdd失败:', errorInfo);
      // message.error('添加用户失败'); // 移至父组件或onAdd的实现中
    } finally {
      setSubmitting(false);
    }
  };

  // 处理取消操作
  const handleCancel = () => {
    // 确保弹窗关闭时表单被重置
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={`添加用户到 ${workspaceName}`}
      open={open}
      onCancel={handleCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
          disabled={users.length === 0}
        >
          批量添加
        </Button>
      ]}
      maskClosable={false}
      destroyOnClose={true}
    >
      <Spin spinning={loading}>
        {users.length === 0 ? (
          <Empty 
            description="没有可添加的用户" 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
          />
        ) : (
          <Form form={form} layout="vertical" preserve={false}>
            <Form.Item
              name="user_ids"
              label="选择用户"
              rules={[{ required: true, message: '请选择用户' }]}
            >
              <Select
                mode="multiple"
                placeholder="请选择用户"
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                options={users.map(user => ({
                  value: user.id,
                  label: `${user.username}${user.email ? ` (${user.email})` : ''}`
                }))}
                maxTagCount={3}
                maxTagTextLength={10}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="role"
              label="批量设置角色"
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