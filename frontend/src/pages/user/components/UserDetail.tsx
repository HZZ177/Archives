import React, { useState, useEffect } from 'react';
import { Spin, message, Tabs, Form, Input, Button, Switch, Card, Result, Select } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/constants';
import { fetchRoles, fetchUserRoles, updateUserRoles } from '../../../apis/roleService';
import { Role } from '../../../types/role';
import UserWorkspacePermissions from './UserWorkspacePermissions';
import { useUser } from '../../../contexts/UserContext';

const { TabPane } = Tabs;

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [username, setUsername] = useState('');
  const [form] = Form.useForm();
  const { userState } = useUser();
  const isAdmin = userState.currentUser?.username === 'admin';
  
  // 添加角色状态
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  // 添加是否为超级管理员的状态
  const [isSuperUser, setIsSuperUser] = useState(false);
  
  const isNewUser = id === 'new';

  // 获取所有角色列表
  const fetchAllRoles = async () => {
    try {
      setLoadingRoles(true);
      const data = await fetchRoles();
      
      // 处理不同格式的返回值
      if (Array.isArray(data)) {
        setRoles(data);
      } else {
        setRoles((data as any)?.items ?? []);
      }
      setLoadingRoles(false);
    } catch (error) {
      console.error('获取角色列表失败:', error);
      message.error('获取角色列表失败');
      setLoadingRoles(false);
    }
  };

  // 初始化时获取角色列表
  useEffect(() => {
    fetchAllRoles();
  }, []);

  // 获取用户数据或文档内容
  useEffect(() => {
    // 如果是新用户，不需要获取数据
    if (isNewUser) {
      setLoading(false);
      return;
    }
    
    // 如果是编辑用户，获取用户数据
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        const token = localStorage.getItem('token');
        const headers = {
          Authorization: `Bearer ${token}`
        };
        
        // 获取用户数据
        const response = await axios.get(`${API_BASE_URL}/users/${id}`, { headers });
        
        // 设置表单初始值
        form.setFieldsValue({
          username: response.data.username,
          email: response.data.email,
          mobile: response.data.mobile,
          is_superuser: response.data.is_superuser,
        });
        
        // 更新本地状态
        setUsername(response.data.username);
        // 更新超级管理员状态
        setIsSuperUser(response.data.is_superuser);
        
        // 获取用户的角色
        try {
          const userRoles = await fetchUserRoles(Number(id));
          const roleIds = userRoles.map((role: Role) => role.id);
          setSelectedRoleIds(roleIds);
          
          // 更新表单中的角色字段
          form.setFieldsValue({
            role_ids: roleIds
          });
        } catch (error) {
          console.error('获取用户角色失败:', error);
          message.error('获取用户角色失败');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        message.error('获取用户数据失败');
        setLoading(false);
      }
    };
    
    // 如果不是新用户，尝试获取用户数据
    if (!isNaN(Number(id))) {
      // ID是数字，获取用户数据
      fetchUserData();
    } else {
      // ID不是数字，且不是'new'（已经在前面的if判断中排除），显示错误或重定向
      setLoading(false);
      message.error("无效的用户ID");
      // navigate('/some-error-page'); // 可以导航到错误页面
    }
  }, [id, form, isNewUser]);
  
  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      // 移除角色ID，只提交用户基本信息
      const userUpdateData = { ...values };
      delete userUpdateData.role_ids;
      
      if (isNewUser) {
        // 创建用户
        const response = await axios.post(`${API_BASE_URL}/users`, values, { headers });
        message.success('用户创建成功');
        // 导航到新创建的用户详情页
        navigate(`/user/${response.data.id}`);
      } else {
        // 更新用户
        await axios.post(`${API_BASE_URL}/users/update/${id}`, userUpdateData, { headers });
        
        // 更新用户角色
        if (values.role_ids && !isSuperUser) {
          await updateUserRoles(Number(id), values.role_ids);
        }
        
        message.success('角色更新成功');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('更新用户角色失败:', error);
      message.error('更新用户角色失败');
    }
  };

  // 渲染用户表单
  const renderUserForm = () => {
    return (
      <>
        <Card title={isNewUser ? "创建新用户" : "编辑用户"} bordered={false}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              is_superuser: false
            }}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>
            
            {isNewUser && (
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>
            )}
            
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { type: 'email', message: '邮箱格式不正确' }
              ]}
            >
              <Input placeholder="请输入邮箱" />
            </Form.Item>
            
            <Form.Item
              name="mobile"
              label="手机号"
              rules={[
                { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
              ]}
            >
              <Input placeholder="请输入手机号" />
            </Form.Item>
            
            {isAdmin && (
              <Form.Item
                name="is_superuser"
                label="是否超级管理员"
                valuePropName="checked"
              >
                <Switch onChange={handleSuperUserChange} />
              </Form.Item>
            )}
            
            <Form.Item
              name="role_ids"
              label="角色"
              help={isSuperUser ? "当前用户已设置为管理员，无须选择角色" : "请选择用户角色"}
              rules={[
                {
                  required: !isSuperUser,
                  message: '请至少选择一个角色'
                }
              ]}
            >
              <Select
                mode="multiple"
                placeholder={isSuperUser ? "当前用户已设置为管理员，无须选择角色" : "请选择角色"}
                loading={loadingRoles}
                style={{ width: '100%' }}
                optionFilterProp="label"
                disabled={isSuperUser}
              >
                {roles.map(role => (
                  <Select.Option key={role.id} value={role.id} label={role.name}>
                    {role.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存
              </Button>
              <Button style={{ marginLeft: 8 }} onClick={() => navigate('/users')}>
                取消
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </>
    );
  };

  const handleSuperUserChange = (checked: boolean) => {
    setIsSuperUser(checked);
  };

  return (
    <Spin spinning={loading}>
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="基础信息" key="info">
            {renderUserForm()}
          </TabPane>
          {!isNewUser && (
            <TabPane tab="工作区与权限" key="permissions">
              <UserWorkspacePermissions userId={Number(id)} username={username} />
            </TabPane>
          )}
        </Tabs>
      </Card>
    </Spin>
  );
};

export default UserDetail;
