import { Link } from 'react-router-dom';
import PageHeading from './PageHeading';
import React, { useState } from 'react';
import { Tabs, Card, Space } from 'antd';
import { UserOutlined, SettingOutlined, RobotOutlined, ExperimentOutlined } from '@ant-design/icons';
import UserSettings from './UserSettings';
import UserLLMSettings from './UserLLMSettings';
import UserEmbeddingsSettings from './UserEmbeddingsSettings';


const UserSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');

  const tabItems = [
    {
      key: 'profile',
      label: (
        <Space>
          <UserOutlined />
          个人信息
        </Space>
      ),
      children: <UserSettings />
    },
    {
      key: 'llm',
      label: (
        <Space>
          <RobotOutlined />
          AI 模型
        </Space>
      ),
      children: <UserLLMSettings />
    },
    {
      key: 'embeddings',
      label: (
        <Space>
          <ExperimentOutlined />
          问答检索配置
        </Space>
      ),
      children: <UserEmbeddingsSettings />
    },

  ];

  return (
    <div className="settings-page">
      <PageHeading eyebrow="YOUR WORKSPACE" title="设置" description="让这个空间，更适合你的工作习惯。" />
      <div className="settings-links"><Link to="/app/backup">数据备份与恢复</Link><Link to="/app/api-management">API 管理</Link><Link to="/app/recycle">日记回收站</Link></div>
      <Card
        title={
          <Space>
            <SettingOutlined />
            用户设置
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ padding: '0 24px' }}
        />
      </Card>
    </div>
  );
};

export default UserSettingsPage;