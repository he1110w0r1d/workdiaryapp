import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import AuthFrame from './AuthFrame';
import api from '../utils/api';  // 修改这里



const Register = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/users/register', values);
      message.success('注册成功！');
      
      // 如果注册返回了token，直接登录
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        navigate('/llm-setup');
      } else {
        // 否则跳转到登录页
        navigate('/login');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="创建你的工作空间" subtitle="从第一篇日记，开始积累。">
        <Form
          name="register"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="怎么称呼你" autoComplete="nickname" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱!' },
              { type: 'email', message: '请输入有效的邮箱地址!' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="name@example.com" autoComplete="email" type="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码!' },
              { min: 6, message: '密码至少6位!' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="new-password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>

          <Form.Item style={{ textAlign: 'center' }}>
            <Link to="/login">已有账号？立即登录</Link>
          </Form.Item>
        </Form>
    </AuthFrame>
  );
};

export default Register;