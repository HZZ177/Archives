import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import ChangePasswordModal from '../common/ChangePasswordModal';
import { message } from 'antd';

interface PasswordChangeWrapperProps {
  children: React.ReactNode;
}

const PasswordChangeWrapper: React.FC<PasswordChangeWrapperProps> = ({ children }) => {
  const { userState, logout } = useUser();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  
  useEffect(() => {
    // 检查登录响应中是否有need_change_password标志
    const loginResult = localStorage.getItem('login_result');
    if (loginResult) {
      try {
        const parsedResult = JSON.parse(loginResult);
        if (parsedResult.need_change_password) {
          setShowPasswordModal(true);
          setIsFirstLogin(true);  // 需要修改密码时，视为首次登录
          
          // 将需要修改密码的状态保存到localStorage，确保用户刷新或关闭后再打开仍然需要修改密码
          localStorage.setItem('needs_password_change', 'true');
          
          // 不立即删除login_result，在密码修改成功后再删除
        }
      } catch (error) {
        console.error('解析登录结果失败:', error);
        localStorage.removeItem('login_result');
      }
    } else if (userState.isLoggedIn) {
      // 检查是否有未完成的密码修改任务
      const needsPasswordChange = localStorage.getItem('needs_password_change');
      if (needsPasswordChange === 'true') {
        setShowPasswordModal(true);
        setIsFirstLogin(true);
      }
    }
  }, [userState.isLoggedIn]);
  
  // 当用户尝试关闭弹窗时的处理
  const handleCloseModal = () => {
    // 首次登录时不允许关闭
    if (isFirstLogin) {
      message.warning('首次登录必须修改密码，这是为了保障您的账户安全');
      return;
    }
    
    setShowPasswordModal(false);
  };
  
  // 密码修改成功后的处理
  const handlePasswordChanged = () => {
    // 清除所有标记
    localStorage.removeItem('login_result');
    localStorage.removeItem('needs_password_change');
    setShowPasswordModal(false);
    setIsFirstLogin(false);
    
    message.success('密码修改成功，现在您可以开始使用系统');
  };
  
  return (
    <>
      {children}
      
      {userState.isLoggedIn && userState.currentUser && (
        <ChangePasswordModal
          visible={showPasswordModal}
          onClose={isFirstLogin ? handlePasswordChanged : handleCloseModal}
          userMobile={userState.currentUser.mobile}
          isFirstLogin={isFirstLogin}
        />
      )}
    </>
  );
};

export default PasswordChangeWrapper; 