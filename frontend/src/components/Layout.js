import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, Button, Avatar, Dropdown, Space, Typography, Spin, Modal } from 'antd';
import { 
  HomeOutlined, 
  FileTextOutlined, 
  BarChartOutlined, 
  UserOutlined,
  QuestionCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  LogoutOutlined,
  RobotOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  CloudDownloadOutlined
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
  const [pendingTodosCount, setPendingTodosCount] = useState(0);
  const [unreadSummariesCount, setUnreadSummariesCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const currentTheme = {
    colors: {
      primary: '#1E3A8A',
      secondary: '#2563EB', 
      accent: '#3B82F6',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#1F2937',
      textSecondary: '#6B7280',
      border: '#E5E7EB'
    }
  };

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

  // 获取待办事项数量
  const fetchPendingTodosCount = async () => {
    try {
      const response = await api.get('/todos?status=待办');
      const pendingTodos = response.data.todos || [];
      setPendingTodosCount(pendingTodos.length);
    } catch (error) {
      console.error('获取待办事项数量失败:', error);
    }
  };

  // 获取未读总结数量
  const fetchUnreadSummariesCount = async () => {
    try {
      const response = await api.get('/summaries/unread/count');
      setUnreadSummariesCount(response.data.total || 0);
    } catch (error) {
      console.error('获取未读总结数量失败:', error);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    fetchPendingTodosCount();
    fetchUnreadSummariesCount();

    // 监听用户信息更新事件
    const handleUserInfoUpdate = () => {
      fetchUserInfo();
    };

    // 监听待办事项更新事件
    const handleTodosUpdate = () => {
      fetchPendingTodosCount();
    };

    // 监听总结更新事件
    const handleSummariesUpdate = () => {
      fetchUnreadSummariesCount();
    };

    window.addEventListener('userInfoUpdated', handleUserInfoUpdate);
    window.addEventListener('todosUpdated', handleTodosUpdate);
    window.addEventListener('summariesUpdated', handleSummariesUpdate);
    
    return () => {
        window.removeEventListener('userInfoUpdated', handleUserInfoUpdate);
        window.removeEventListener('todosUpdated', handleTodosUpdate);
        window.removeEventListener('summariesUpdated', handleSummariesUpdate);
      };
    }, []);
  
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/app',
      icon: <HomeOutlined />,
      label: <Link to="/app">仪表板</Link>,
    },
    {
      key: '/app/diaries',
      icon: <FileTextOutlined />,
      label: <Link to="/app/diaries">工作日记</Link>,
    },
    {
      key: '/app/todos',
      icon: <CheckSquareOutlined />,
      label: (
        <Link to="/app/todos">
          待办管理{pendingTodosCount > 0 && `（${pendingTodosCount}）`}
        </Link>
      ),
    },
    {
      key: '/app/summaries',
      icon: <BarChartOutlined />,
      label: (
        <Link to="/app/summaries">
          工作总结{unreadSummariesCount > 0 && `（${unreadSummariesCount}）`}
        </Link>
      ),
    },
    {
      key: '/app/model-settings',
      icon: <RobotOutlined />,
      label: <Link to="/app/model-settings">模型设置</Link>,
    },
    {
      key: '/app/user-settings',
      icon: <UserOutlined />,
      label: <Link to="/app/user-settings">用户设置</Link>,
    },
    {
      key: '/app/recycle',
      icon: <DeleteOutlined />,
      label: <Link to="/app/recycle">日记回收站</Link>,
    },
    {
      key: '/app/backup',
      icon: <CloudDownloadOutlined />,
      label: <Link to="/app/backup">数据备份</Link>,
    },
    {
      key: '/app/rag',
      icon: <QuestionCircleOutlined />,
      label: <Link to="/app/rag">RAG问答</Link>,
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/welcome');
  };

  const handleAvatarClick = () => {
    navigate('/app/user-settings');
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
          overflow: 'auto',
          backgroundColor: currentTheme.colors.primary
        }}
      >
        <div 
          className="logo" 
          style={{ 
            height: '48px', 
            margin: '16px', 
            background: currentTheme.colors.secondary,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '8px'
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
          background: currentTheme.colors.primary,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          height: '64px',
          borderBottom: `1px solid ${currentTheme.colors.border}`
        }}>
          <div style={{ 
            color: 'white', 
            fontSize: '16px', 
            fontWeight: '600'
          }}>
            工作日记系统
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={() => {
                Modal.info({
                  title: '使用说明',
                  width: 600,
                  content: (
                    <div>
                      <h4>工作日记系统使用指南</h4>
                      
                      <h5 style={{ marginTop: '16px' }}>核心功能模块</h5>
                      <ul style={{ lineHeight: '1.6' }}>
                        <li><strong>仪表板：</strong>查看工作数据统计和图表分析</li>
                        <li><strong>工作日记：</strong>记录每日工作内容</li>
                        <li><strong>待办管理：</strong>管理待办事项</li>
                        <li><strong>工作总结：</strong>AI智能生成总结</li>
                        <li><strong>模型设置：</strong>配置AI助手参数</li>
                        <li><strong>用户设置：</strong>管理个人信息</li>
                      </ul>
                    </div>
                  )
                });
              }}
              style={{ 
                color: 'white',
                fontSize: '14px',
                fontWeight: 'normal'
              }}
              title="使用说明"
            >
              帮助
            </Button>
            
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ 
                color: 'white',
                fontSize: '14px',
                fontWeight: 'normal'
              }}
              title="退出登录"
            >
              退出
            </Button>
            
            <Avatar 
              size="default" 
              src={userInfo?.avatar ? `${process.env.REACT_APP_API_URL.replace('/api', '')}${userInfo.avatar}` : undefined}
              icon={!userInfo?.avatar ? <UserOutlined /> : undefined}
              onClick={handleAvatarClick}
              title="点击进入用户设置"
              style={{ 
                cursor: 'pointer',
                background: userInfo?.avatar ? 'transparent' : currentTheme.colors.accent,
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)'
              }} 
            />
          </div>
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