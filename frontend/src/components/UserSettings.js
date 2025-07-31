import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Avatar, Upload, message, Divider, Typography, Space, Spin } from 'antd';
import { UserOutlined, SaveOutlined, UploadOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const { Title, Text } = Typography;

const UserSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await api.get('/users/profile');
        const userData = response.data;
        setUserInfo(userData);
        form.setFieldsValue({
          username: userData.username,
          email: userData.email,
          nickname: userData.nickname || '',
          bio: userData.bio || ''
        });
      } catch (error) {
        console.error('获取用户信息失败:', error);
        message.error('获取用户信息失败: ' + (error.response?.data?.message || error.message));
        if (error.response?.status === 401) {
          navigate('/login');
        }
      } finally {
        setPageLoading(false);
      }
    };

    fetchUserProfile();
  }, [form, navigate]);

  const handleSave = async (values) => {
    setLoading(true);
    try {
      const response = await api.put('/users/profile', values);
      message.success('设置保存成功！');
      setUserInfo({ ...userInfo, ...values });
      console.log('用户信息更新成功:', response.data);
    } catch (error) {
      console.error('保存用户设置失败:', error);
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    message.success('已退出登录');
    navigate('/login');
  };

  const handleAvatarUpload = (info) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }
    if (info.file.status === 'done') {
      setLoading(false);
      const response = info.file.response;
      if (response && response.avatar) {
        setUserInfo({ ...userInfo, avatar: response.avatar });
        message.success('头像上传成功');
        // 触发用户信息更新事件，通知Layout组件刷新头像
        window.dispatchEvent(new CustomEvent('userInfoUpdated'));
      }
    } else if (info.file.status === 'error') {
      setLoading(false);
      message.error('头像上传失败: ' + (info.file.response?.message || '未知错误'));
    }
  };

  if (pageLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>加载用户信息中...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <UserOutlined /> 用户设置
          </Space>
        }
        loading={!userInfo}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar 
            size={80} 
            src={userInfo?.avatar ? `http://localhost:5000${userInfo.avatar}` : undefined}
            icon={!userInfo?.avatar ? <UserOutlined /> : undefined}
            style={{ 
              background: userInfo?.avatar ? 'transparent' : 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: '#333',
              border: '3px solid #f0f0f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          />
          <div style={{ marginTop: 12 }}>
            <Upload
              name="avatar"
              action="http://localhost:5000/api/users/upload-avatar"
              headers={{
                authorization: `Bearer ${localStorage.getItem('token')}`,
              }}
              showUploadList={false}
              onChange={handleAvatarUpload}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />} size="small">
                更换头像
              </Button>
            </Upload>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={userInfo}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="邮箱地址" />
          </Form.Item>

          <Form.Item
            name="nickname"
            label="昵称"
          >
            <Input placeholder="昵称（可选）" />
          </Form.Item>

          <Form.Item
            name="bio"
            label="个人简介"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="简单介绍一下自己..." 
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Divider />

          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<SaveOutlined />}
            >
              保存设置
            </Button>
            
            <Button 
              danger 
              onClick={handleLogout}
              icon={<LogoutOutlined />}
            >
              退出登录
            </Button>
          </div>
        </Form>

        <Divider />
        
        <div style={{ textAlign: 'center', color: '#666' }}>
          <Text type="secondary">
            注册时间: {userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString() : '未知'}
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default UserSettings;