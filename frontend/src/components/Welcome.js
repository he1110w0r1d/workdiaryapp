import React from 'react';
import { Card, Button, Typography, Space, Row, Col } from 'antd';
import { UserAddOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card 
        style={{ 
          width: 600, 
          textAlign: 'center',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📝</div>
          <Title level={1} style={{ color: '#1890ff', marginBottom: '8px' }}>
            工作日记系统
          </Title>
          <Paragraph style={{ fontSize: '16px', color: '#666' }}>
            记录每日工作，智能生成总结，提升工作效率
          </Paragraph>
        </div>

        <Row gutter={[16, 16]} justify="center">
          <Col span={12}>
            <Card 
              hoverable
              style={{ 
                borderRadius: '12px',
                border: '2px solid #f0f0f0'
              }}
              styles={{ body: { padding: '24px 16px' } }}
            >
              <div style={{ marginBottom: '16px', fontSize: '32px' }}>🚀</div>
              <Title level={4}>新用户注册</Title>
              <Paragraph style={{ color: '#666', marginBottom: '20px' }}>
                创建账号，开始您的工作记录之旅
              </Paragraph>
              <Button 
                type="primary" 
                size="large" 
                icon={<UserAddOutlined />}
                onClick={() => navigate('/register')}
                style={{ width: '100%' }}
              >
                立即注册
              </Button>
            </Card>
          </Col>
          <Col span={12}>
            <Card 
              hoverable
              style={{ 
                borderRadius: '12px',
                border: '2px solid #f0f0f0'
              }}
              styles={{ body: { padding: '24px 16px' } }}
            >
              <div style={{ marginBottom: '16px', fontSize: '32px' }}>🔑</div>
              <Title level={4}>用户登录</Title>
              <Paragraph style={{ color: '#666', marginBottom: '20px' }}>
                已有账号？立即登录使用系统
              </Paragraph>
              <Button 
                size="large" 
                icon={<LoginOutlined />}
                onClick={() => navigate('/login')}
                style={{ width: '100%' }}
              >
                立即登录
              </Button>
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: '32px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
          <Title level={5} style={{ marginBottom: '12px' }}>✨ 主要功能</Title>
          <Row gutter={[16, 8]}>
            <Col span={8}>
              <Space>
                <span>📊</span>
                <span>智能总结</span>
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <span>📅</span>
                <span>日程管理</span>
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <span>🤖</span>
                <span>AI助手</span>
              </Space>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  );
};

export default Welcome;