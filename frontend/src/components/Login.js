import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import AuthFrame from './AuthFrame';
import api from '../utils/api';  // 修改这里



const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/users/login', values);
      localStorage.setItem('token', response.data.token);
      message.success('登录成功');
      navigate('/app');
    } catch (error) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="欢迎回来" subtitle="继续记录，接着把事情做好。">
        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="name@example.com" autoComplete="username" type="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>

          <Form.Item style={{ textAlign: 'center' }}>
            <Link to="/register">还没有账号？立即注册</Link>
          </Form.Item>
        </Form>
    </AuthFrame>
  );
};

export default Login;