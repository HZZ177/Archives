import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Spin, Row, Col, Descriptions, Modal } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useUser } from '../../contexts/UserContext';
import authAPI from '../../apis/auth';
import { updateUser } from '../../apis/userService';
import { User, ChangePasswordParams } from '../../types/user';

const ProfilePage: React.FC = () => {
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const { userState, refreshUserInfo, updateUserInfo, changePassword: changePasswordContext } = useUser();
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState<boolean>(false);
  const [passwordFormLoading, setPasswordFormLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        let userToSet: User | null = null;
        if (userState.currentUser) {
          userToSet = userState.currentUser;
        } else {
          const userFromApi = await authAPI.getCurrentUser();
          userToSet = userFromApi;
        }
        
        if (userToSet) {
          setCurrentUser(userToSet);
          form.setFieldsValue({
            username: userToSet.username,
            email: userToSet.email,
            mobile: userToSet.mobile,
          });
        } else {
          message.error('未能加载用户信息');
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        message.error('获取用户信息失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userState.currentUser, updateUserInfo]);

  const handleProfileUpdateFinish = async (values: { username: string; email?: string; mobile?: string }) => {
    if (!currentUser || !currentUser.id) {
      message.error('无法更新：用户信息不完整。');
      return;
    }
    setFormLoading(true);
    try {
      const updatedUserData = await updateUser(currentUser.id, values);
      if (updateUserInfo) {
        updateUserInfo(updatedUserData);
      }
      setCurrentUser(updatedUserData);
      form.setFieldsValue(updatedUserData);
      message.success('基本信息更新成功！');
    } catch (error: any) {
      console.error('更新用户信息失败:', error);
      message.error(error.response?.data?.message || error.message || '更新用户信息失败，请稍后重试');
    } finally {
      setFormLoading(false);
    }
  };
  
  const showPasswordModal = () => {
    setIsPasswordModalVisible(true);
    passwordForm.resetFields();
  };

  const handlePasswordModalCancel = () => {
    setIsPasswordModalVisible(false);
  };

  const handlePasswordChangeFinish = async (values: ChangePasswordParams) => {
    const apiParams: ChangePasswordParams = {
      old_password: values.old_password,
      new_password: values.new_password,
    };

    setPasswordFormLoading(true);
    try {
      if (changePasswordContext) {
        await changePasswordContext(apiParams);
      } else {
        await authAPI.changePassword(apiParams);
        message.success('密码修改成功！');
      }
      setIsPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      console.error('修改密码失败:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || error.message || '修改密码失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setPasswordFormLoading(false);
    }
  };

  if (loading && !currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        无法加载用户信息。
      </div>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Spin spinning={loading}>
          <Card title="基本信息">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleProfileUpdateFinish}
            >
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名!' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="用户名" />
              </Form.Item>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { type: 'email', message: '请输入有效的邮箱地址!' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="邮箱 (可选)" />
              </Form.Item>
              <Form.Item
                name="mobile"
                label="手机号"
              >
                <Input prefix={<PhoneOutlined />} placeholder="手机号 (可选)" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={formLoading}>
                  保存更改
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Spin>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="账户详情 (只读)">
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="用户ID">{currentUser.id}</Descriptions.Item>
            <Descriptions.Item label="账户状态">{currentUser.is_active ? '已激活' : '未激活'}</Descriptions.Item>
            <Descriptions.Item label="超级管理员">{currentUser.is_superuser ? '是' : '否'}</Descriptions.Item>
            {currentUser.created_at && <Descriptions.Item label="创建时间">{new Date(currentUser.created_at).toLocaleString()}</Descriptions.Item>}
            {currentUser.updated_at && <Descriptions.Item label="最后更新时间">{new Date(currentUser.updated_at).toLocaleString()}</Descriptions.Item>}
          </Descriptions>
        </Card>
        <Card title="安全设置" style={{ marginTop: 16 }}>
          <Button type="default" onClick={showPasswordModal}>
            修改密码
          </Button>
        </Card>
      </Col>
      <Modal
        title="修改密码"
        visible={isPasswordModalVisible}
        onCancel={handlePasswordModalCancel}
        footer={null}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChangeFinish}
          name="changePasswordForm"
        >
          <Form.Item
            name="old_password"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码!' }]}
          >
            <Input.Password placeholder="当前密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码!' },
            ]}
            hasFeedback
          >
            <Input.Password placeholder="新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_new_password"
            label="确认新密码"
            dependencies={['new_password']}
            hasFeedback
            rules={[
              { required: true, message: '请再次输入新密码!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致!'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="确认新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={passwordFormLoading}>
              确认修改
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={handlePasswordModalCancel}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
};

export default ProfilePage; 