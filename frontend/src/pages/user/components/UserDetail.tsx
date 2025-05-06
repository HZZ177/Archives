import React, { useState, useEffect } from 'react';
import { Spin, message, Tabs, Form, Input, Button, Switch, Card, Result } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { Section } from '../../../types/document';
import FunctionOverview from '../../../components/business/SectionModules/FunctionOverview';
import DiagramUpload from '../../../components/business/SectionModules/DiagramUpload';
import FunctionDetail from '../../../components/business/SectionModules/FunctionDetail';
import DatabaseTable from '../../../components/business/SectionModules/DatabaseTable';
import RelatedModules from '../../../components/business/SectionModules/RelatedModules';
import ApiInterface from '../../../components/business/SectionModules/ApiInterface';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/constants';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeTab, setActiveTab] = useState('document');
  const [form] = Form.useForm();
  
  const isNewUser = id === 'new';

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
          is_active: response.data.is_active,
          is_superuser: response.data.is_superuser,
        });
        
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
      // ID不是数字，且不是'new'（已经在前面的if判断中排除），获取文档数据
      fetchDocumentDetail();
    }
  }, [id, form, isNewUser]);
  
  // 获取文档详情
  const fetchDocumentDetail = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      // 假设这是获取用户模块文档详情的API
      const response = await axios.get(`${API_BASE_URL}/documents/user-module`, { headers });
      
      // 预设各部分的section
      const defaultSections: Section[] = [
        {
          id: 1,
          document_id: 1,
          section_type: 'overview',
          title: '模块功能概述',
          content: '用户模块提供主要面向系统管理员的用户内部用户信息和权限管理，包括用户的创建、注册、注销、认证以及权限分配等功能。\n\n主要功能模块：\n1. 用户信息管理：支持基础用户信息的创建、修改和删除\n2. 认证与授权：使用JWT进行身份验证，采用RBAC授权模式\n3. 第三方账号管理：支持第三方账号绑定的管理',
          display_order: 1
        },
        {
          id: 2,
          document_id: 1,
          section_type: 'diagram',
          title: '逻辑图/数据流向图',
          display_order: 2,
          images: []
        },
        {
          id: 3,
          document_id: 1,
          section_type: 'detail',
          title: '功能详解',
          content: `<h3>1. 用户基本功能</h3>
<p>系统分为多种用户类型，主要包括：</p>
<ul>
<li>管理员用户：拥有系统全部操作和管理权限</li>
<li>普通运营用户：拥有内容和资料管理权限</li>
<li>只读用户：仅有查看权限</li>
</ul>

<h3>2. 安全模块</h3>
<ul>
<li>密码策略：使用bcrypt算法进行密码加密存储</li>
<li>登录安全：支持登录失败次数限制</li>
<li>会话管理：基于JWT Token令牌管理</li>
<li>权限控制：使用基于角色的访问控制</li>
<li>日志记录：记录用户IP、设备、操作时间</li>
</ul>

<h3>3. 规格限制</h3>
<ul>
<li>用户名：允许6-20个字符，支持中英文</li>
<li>密码：要求8-20位，必须包含字母和数字，区分大小写</li>
<li>邮箱限制：单个邮箱仅允许注册一个账号</li>
<li>手机号：支持验证并用于找回密码</li>
</ul>`,
          display_order: 3
        },
        {
          id: 4,
          document_id: 1,
          section_type: 'database',
          title: '数据库表',
          content: JSON.stringify([
            {
              name: 'id',
              type: 'bigint',
              required: true,
              description: '主键'
            },
            {
              name: 'username',
              type: 'varchar',
              length: '50',
              required: true,
              description: '用户名'
            },
            {
              name: 'password',
              type: 'varchar',
              length: '100',
              required: true,
              description: '加密存储'
            },
            {
              name: 'email',
              type: 'varchar',
              length: '100',
              required: false,
              description: '邮箱'
            },
            {
              name: 'mobile',
              type: 'varchar',
              length: '20',
              required: false,
              description: '手机号'
            },
            {
              name: 'status',
              type: 'tinyint',
              required: true,
              description: '0:禁用 1:正常'
            },
            {
              name: 'create_time',
              type: 'datetime',
              required: true,
              description: '创建时间'
            }
          ]),
          display_order: 4
        },
        {
          id: 5,
          document_id: 1,
          section_type: 'relation',
          title: '关联模块',
          display_order: 5
        },
        {
          id: 6,
          document_id: 1,
          section_type: 'api',
          title: '涉及接口',
          content: JSON.stringify({
            endpoints: [
              {
                path: '/api/v1/auth/login',
                method: 'POST',
                description: '用户登录',
                request: {
                  username: 'string',
                  password: 'string'
                },
                response: {
                  token: 'JWT Token',
                  userinfo: {
                    id: 'integer',
                    username: 'string',
                    email: 'string',
                    mobile: 'string'
                  }
                }
              },
              {
                path: '/api/v1/users',
                method: 'GET',
                description: '获取用户列表',
                request: {
                  page: 'integer',
                  pageSize: 'integer',
                  keyword: 'string'
                },
                response: {
                  total: 'integer',
                  items: 'array'
                }
              }
            ]
          }),
          display_order: 6
        }
      ];
      
      // 使用后端返回的数据或使用默认数据
      setSections(response.data?.sections || defaultSections);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch document detail:', error);
      // 使用默认数据
      setLoading(false);
      message.error('获取模块文档失败，使用默认数据');
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      if (isNewUser) {
        // 创建新用户
        await axios.post(`${API_BASE_URL}/users`, values, { headers });
        message.success('用户创建成功');
        navigate('/users');
      } else {
        // 更新用户
        await axios.put(`${API_BASE_URL}/users/${id}`, values, { headers });
        message.success('用户更新成功');
        navigate('/users');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to save user:', error);
      message.error('保存用户失败');
      setLoading(false);
    }
  };

  // 渲染用户表单
  const renderUserForm = () => {
    return (
      <Card title={isNewUser ? "创建新用户" : "编辑用户"} bordered={false}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            is_active: true,
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
            name="full_name"
            label="姓名"
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          
          <Form.Item
            name="is_active"
            label="是否启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name="is_superuser"
            label="是否管理员"
            valuePropName="checked"
          >
            <Switch />
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
    );
  };

  // 更新内容
  const handleSectionUpdate = async (sectionId: number, content: string) => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      // 发送更新请求
      await axios.put(`${API_BASE_URL}/sections/${sectionId}`, {
        content
      }, { headers });
      
      // 更新本地状态
      setSections(sections.map(section => 
        section.id === sectionId ? { ...section, content } : section
      ));
      
      message.success('保存成功');
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 处理图片上传
  const handleImageUpload = async (sectionId: number, file: File) => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const formData = new FormData();
      formData.append('file', file);
      
      // 发送上传请求
      const response = await axios.post(
        `${API_BASE_URL}/sections/${sectionId}/images`,
        formData,
        { 
          headers: {
            ...headers,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // 更新本地状态
      setSections(sections.map(section => {
        if (section.id === sectionId) {
          const images = section.images || [];
          return {
            ...section,
            images: [...images, response.data]
          };
        }
        return section;
      }));
      
      return response.data;
    } catch (error) {
      message.error('图片上传失败');
      throw error;
    }
  };

  // 处理图片删除
  const handleImageDelete = async (imageId: number) => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      // 发送删除请求
      await axios.delete(`${API_BASE_URL}/images/${imageId}`, { headers });
      
      // 更新本地状态
      setSections(sections.map(section => {
        if (section.images) {
          return {
            ...section,
            images: section.images.filter(image => image.id !== imageId)
          };
        }
        return section;
      }));
      
      message.success('图片删除成功');
    } catch (error) {
      message.error('图片删除失败');
      throw error;
    }
  };

  // 获取指定类型的section
  const getSection = (type: string): Section => {
    return sections.find(section => section.section_type === type) || {
      id: 0,
      document_id: 0,
      section_type: type as any,
      title: '',
      content: '',
      display_order: 0
    };
  };

  if (loading) {
    return <Spin size="large" tip="加载中..." />;
  }

  const renderDocumentContent = () => (
    <div>
      <FunctionOverview 
        section={getSection('overview')} 
        onSave={(content) => handleSectionUpdate(getSection('overview').id, content)} 
      />
      
      <div style={{ marginTop: 16 }}>
        <DiagramUpload 
          section={getSection('diagram')} 
          onUpload={(file) => handleImageUpload(getSection('diagram').id, file)}
          onDelete={handleImageDelete}
        />
      </div>
      
      <div style={{ marginTop: 16 }}>
        <FunctionDetail 
          section={getSection('detail')} 
          onSave={(content) => handleSectionUpdate(getSection('detail').id, content)} 
        />
      </div>
      
      <div style={{ marginTop: 16 }}>
        <DatabaseTable 
          section={getSection('database')} 
          onSave={(content) => handleSectionUpdate(getSection('database').id, content)} 
        />
      </div>
      
      <div style={{ marginTop: 16 }}>
        <RelatedModules 
          section={getSection('relation')}
          documentId={Number(id)} 
          onSave={(content) => handleSectionUpdate(getSection('relation').id, content)} 
        />
      </div>
      
      <div style={{ marginTop: 16 }}>
        <ApiInterface 
          section={getSection('api')} 
          onSave={(content) => handleSectionUpdate(getSection('api').id, content)} 
        />
      </div>
    </div>
  );

  // 渲染内容
  return (
    <Spin spinning={loading}>
      {isNewUser ? (
        // 新用户表单，显示标题和表单
        <div>
          <h2>创建新用户</h2>
          {renderUserForm()}
        </div>
      ) : (
        // 当不是创建新用户时，才可能显示文档或用户编辑表单
        <div>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              // 只有当ID不是'new'且不是数字时，才可能是文档模块
              ...(isNaN(Number(id)) ? [
                {
                  key: 'document',
                  label: '文档内容',
                  children: renderDocumentContent()
                }
              ] : []),
              // 所有情况下都显示用户信息标签页，但在isNewUser为true时已经在外层条件中排除了
              {
                key: 'user',
                label: '用户信息',
                children: renderUserForm()
              }
            ]}
          />
        </div>
      )}
    </Spin>
  );
};

export default UserDetail; 