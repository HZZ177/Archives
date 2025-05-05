import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Navigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { LoginParams } from '../../types/user';
import { ROUTES } from '../../config/constants';
import styles from './LoginPage.module.css';

const { Title } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { userState, login } = useUser();
  const navigate = useNavigate();

  // 如果已经登录，重定向到首页
  if (userState.isLoggedIn) {
    console.log('用户已登录，重定向到首页');
    return <Navigate to={ROUTES.HOME} replace />;
  }

  // 处理登录
  const handleLogin = async (values: LoginParams) => {
    try {
      setLoading(true);
      console.log('LoginPage: 提交登录请求');
      await login(values);
      console.log('LoginPage: 登录成功，准备跳转');
      message.success('登录成功');
      navigate(ROUTES.HOME);
    } catch (error: any) {
      console.error('LoginPage: 登录失败', error);
      message.error(error.response?.data?.detail || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <Card bordered={false} className={styles.loginCard}>
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="Logo" className={styles.logo} />
            <Title level={3}>资料管理系统</Title>
          </div>
          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={handleLogin}
            autoComplete="off"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input 
                prefix={<UserOutlined />} 
                placeholder="用户名" 
                size="large" 
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>记住我</Checkbox>
              </Form.Item>

              <a href="#" style={{ float: 'right' }}>
                忘记密码
              </a>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage; 