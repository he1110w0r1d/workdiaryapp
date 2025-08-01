import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import api from '../utils/api';

const RootRedirect = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        // 验证token是否有效
        await api.get('/users/profile');
        setIsAuthenticated(true);
      } catch (error) {
        // token无效，清除
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // 如果已登录，重定向到应用主页；否则重定向到欢迎页
  return isAuthenticated ? <Navigate to="/app" replace /> : <Navigate to="/welcome" replace />;
};

export default RootRedirect;