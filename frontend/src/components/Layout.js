import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, Button, Avatar, Dropdown, Space, Typography, Spin } from 'antd';
import { 
  HomeOutlined, 
  FileTextOutlined, 
  BarChartOutlined, 
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,

  ClockCircleOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import moment from 'moment';
import 'moment/locale/zh-cn';
import api from '../utils/api';
import WorkProfileSetup from './WorkProfileSetup';

import { getLunarDateString, getFullLunarString } from '../utils/lunar';

const { Text } = Typography;

const { Header, Sider, Content } = Layout;



// 时间和农历组件
const TimeInfo = () => {
  const [currentTime, setCurrentTime] = useState(moment());
  const [lunarInfo, setLunarInfo] = useState('');
  const [showFullLunar, setShowFullLunar] = useState(false);

  useEffect(() => {
    const updateTimeAndLunar = () => {
      const now = moment();
      setCurrentTime(now);
      
      // 更新农历信息
      const currentDate = now.toDate();
      const lunarDate = getLunarDateString(currentDate);
      const fullLunar = getFullLunarString(currentDate);
      setLunarInfo(showFullLunar ? fullLunar : lunarDate);
    };

    // 立即更新一次
    updateTimeAndLunar();
    
    // 每秒更新时间
    const timer = setInterval(updateTimeAndLunar, 1000);
    return () => clearInterval(timer);
  }, [showFullLunar]);

  const toggleLunarDisplay = () => {
    setShowFullLunar(!showFullLunar);
  };

  return (
    <div 
      style={{ 
        color: 'white', 
        fontSize: '14px', 
        textAlign: 'center', 
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        lineHeight: '1.2'
      }}
      onClick={toggleLunarDisplay}
      title="点击切换农历显示模式"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: '1' }}>
        <ClockCircleOutlined style={{ fontSize: '14px', lineHeight: '1' }} />
        <Text style={{ color: 'white', fontSize: '14px', lineHeight: '1', margin: 0 }}>
          {currentTime.format('HH:mm:ss')}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: '1' }}>
        <CalendarOutlined style={{ fontSize: '12px', lineHeight: '1' }} />
        <Text style={{ color: 'white', fontSize: '12px', lineHeight: '1', margin: 0 }}>
          {currentTime.format('YYYY年MM月DD日')} {lunarInfo}
        </Text>
      </div>
    </div>
  );
};

const AppLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showWorkProfileSetup, setShowWorkProfileSetup] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // 获取用户信息
  const fetchUserInfo = async () => {
    try {
      const response = await api.get('/users/profile');
      setUserInfo(response.data);
      
      // 检查用户是否需要配置工作信息
      const user = response.data;
      if (!user.workProfile || !user.workProfile.industry) {
        // 如果用户没有配置工作信息，显示配置弹窗
        setShowWorkProfileSetup(true);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };

  useEffect(() => {
    fetchUserInfo();

    // 监听用户信息更新事件
    const handleUserInfoUpdate = () => {
      fetchUserInfo();
    };

    window.addEventListener('userInfoUpdated', handleUserInfoUpdate);
    
    return () => {
      window.removeEventListener('userInfoUpdated', handleUserInfoUpdate);
    };
  }, []);
  
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">仪表板</Link>,
    },
    {
      key: '/diaries',
      icon: <FileTextOutlined />,
      label: <Link to="/diaries">工作日记</Link>,
    },

    {
      key: '/summaries',
      icon: <BarChartOutlined />,
      label: <Link to="/summaries">工作总结</Link>,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">系统设置</Link>,
    },
    {
      key: '/user-settings',
      icon: <UserOutlined />,
      label: <Link to="/user-settings">用户设置</Link>,
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleAvatarClick = () => {
    navigate('/user-settings');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          height: '100vh',
          overflow: 'auto'
        }}
      >
        <div 
          className="logo pulse" 
          style={{ 
            height: '48px', 
            margin: '16px', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          {collapsed ? '📝' : '📝 工作日记'}
        </div>
        <Menu 
          theme="dark" 
          selectedKeys={[location.pathname]} 
          mode="inline" 
          items={menuItems} 
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header style={{ 
          padding: '0 24px', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          height: '80px'
        }}>
          <div style={{ 
            color: 'white', 
            fontSize: '18px', 
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
          }}>
            ✨ 欢迎使用工作日记系统
          </div>
          
          {/* 中间信息区域 - 时间、农历显示 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '32px',
            flex: 1, 
            justifyContent: 'center' 
          }}>
            <TimeInfo />
          </div>
          
          <Avatar 
            size="large" 
            src={userInfo?.avatar ? `http://localhost:5000${userInfo.avatar}` : undefined}
            icon={!userInfo?.avatar ? <UserOutlined /> : undefined}
            onClick={handleAvatarClick}
            title="点击进入用户设置"
            style={{ 
              cursor: 'pointer',
              background: userInfo?.avatar ? 'transparent' : 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: '#333',
              border: '2px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }} 
            className="float"
          />
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer }}>
          <Outlet />
        </Content>
      </Layout>
      
      {/* 工作信息配置弹窗 */}
      <WorkProfileSetup
        visible={showWorkProfileSetup}
        onClose={() => setShowWorkProfileSetup(false)}
        onComplete={() => {
          setShowWorkProfileSetup(false);
          fetchUserInfo(); // 重新获取用户信息
        }}
      />
    </Layout>
  );
};

export default AppLayout;