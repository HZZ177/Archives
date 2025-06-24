import React, { useState, useEffect } from 'react';
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

  // 在组件挂载时清理localStorage和sessionStorage中与工作区相关的数据
  useEffect(() => {
    localStorage.removeItem('currentWorkspace');
    sessionStorage.removeItem('currentWorkspace');
  }, []);

  // 如果已经登录，重定向到首页
  if (userState.isLoggedIn) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  // 处理登录
  const handleLogin = async (values: LoginParams) => {
    try {
      setLoading(true);
      await login(values);
      message.success('登录成功');
      
      // 添加短暂延迟，等待权限加载完成
      setTimeout(() => {
        navigate(ROUTES.HOME, { replace: true });
      }, 300);
    } catch (error: any) {
      console.error('LoginPage: 登录失败', error);
      // 优先使用新的统一格式的消息字段
      message.error(error.response?.data?.message || error.response?.data?.detail || '登录失败，请检查用户名/手机号和密码');
    } finally {
      setLoading(false);
    }
  };

  // 用户名或手机号验证规则
  const validateUsernameOrMobile = (_: any, value: string) => {
    if (!value) {
      return Promise.reject('请输入用户名或手机号');
    }
    
    // 简单的手机号格式验证（中国手机号11位数字，以1开头）
    const isMobile = /^1\d{10}$/.test(value);
    
    // 用户名格式验证（至少2个字符，不超过50个字符）
    const isUsername = value.length >= 2 && value.length <= 50;
    
    if (isMobile || isUsername) {
      return Promise.resolve();
    }
    
    return Promise.reject('请输入有效的用户名或手机号');
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <Card bordered={false} className={styles.loginCard}>
          <div className={styles.logoContainer}>
            <img src="/logo.svg" alt="Logo" className={styles.logo} />
            <Title level={3}>智源资料系统</Title>
          </div>
          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={handleLogin}
            autoComplete="off"
          >
            <Form.Item
              name="username"
              rules={[{ validator: validateUsernameOrMobile }]}
            >
              <Input 
                prefix={<UserOutlined />} 
                placeholder="用户名/手机号" 
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