import React, { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { ChangePasswordParams } from '../../types/user';
import { useUser } from '../../contexts/UserContext';
import request from '../../utils/request';
import { APIResponse } from '../../types/api';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  userMobile?: string;
  isFirstLogin?: boolean;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  onClose,
  userMobile,
  isFirstLogin = false
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const handleCancel = () => {
    // 首次登录时不允许取消
    if (isFirstLogin) {
      message.warning('首次登录必须修改密码，这是为了保障您的账户安全');
      return;
    }
    form.resetFields();
    onClose();
  };
  
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // 检查新密码是否与手机号相同
      if (userMobile && values.new_password === userMobile) {
        message.error('新密码不能与手机号相同');
        setLoading(false);
        return;
      }
      
      // 构建请求参数，根据是否首次登录决定是否包含旧密码
      const params: ChangePasswordParams = {
        new_password: values.new_password,
        is_first_login: isFirstLogin
      };
      
      // 非首次登录时需要旧密码
      if (!isFirstLogin) {
        params.old_password = values.old_password;
      }
      
      // 调用API修改密码
      const response = await request.post<APIResponse<any>>('/auth/change-password', params);
      
      if (!response.data.success) {
        message.error(response.data.message || '修改密码失败');
        setLoading(false);
        return;
      }
      
      // 密码修改成功，重置表单并调用回调
      form.resetFields();
      onClose();
    } catch (error: any) {
      console.error('修改密码失败:', error);
      
      // 提取详细错误信息
      let errorMessage = '修改密码失败';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal
      title={isFirstLogin ? "首次登录修改密码" : "修改密码"}
      open={open}
      onCancel={handleCancel}
      maskClosable={!isFirstLogin} // 首次登录时禁止点击蒙层关闭
      closable={!isFirstLogin} // 首次登录时禁用右上角关闭按钮
      keyboard={!isFirstLogin} // 首次登录时禁用ESC键关闭
      footer={
        isFirstLogin ? 
        // 首次登录时只显示确定按钮
        [
          <Button key="submit" type="primary" loading={loading} onClick={handleOk}>
            确定
          </Button>
        ] : 
        // 普通修改密码时显示取消和确定按钮
        [
          <Button key="back" onClick={handleCancel}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={loading} onClick={handleOk}>
            确定
          </Button>
        ]
      }
    >
      <div>
        {isFirstLogin && (
          <div style={{ marginBottom: 16, color: '#ff4d4f' }}>
            <strong>安全提示：</strong>您的密码与手机号相同，请立即修改密码以保障账户安全
          </div>
        )}
        <Form form={form} layout="vertical">
          {/* 非首次登录时显示旧密码输入框 */}
          {!isFirstLogin && (
            <Form.Item
              name="old_password"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="请输入当前密码" />
            </Form.Item>
          )}
          
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6个字符' }
            ]}
            help="密码要求：长度至少6个字符，且不能与手机号相同"
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};

export default ChangePasswordModal; 