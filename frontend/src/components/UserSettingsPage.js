import React, { useState } from 'react';
import { Tabs, Card, Space } from 'antd';
import { UserOutlined, SettingOutlined, RobotOutlined, ExperimentOutlined, ApiOutlined } from '@ant-design/icons';
import UserSettings from './UserSettings';
import UserLLMSettings from './UserLLMSettings';
import UserEmbeddingsSettings from './UserEmbeddingsSettings';
import ApiKeySettings from './ApiKeySettings';

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
          个人LLM设置
        </Space>
      ),
      children: <UserLLMSettings />
    },
    {
      key: 'embeddings',
      label: (
        <Space>
          <ExperimentOutlined />
          用户嵌入设置
        </Space>
      ),
      children: <UserEmbeddingsSettings />
    },
    {
      key: 'apikeys',
      label: (
        <Space>
          <ApiOutlined />
          API Key管理
        </Space>
      ),
      children: <ApiKeySettings />
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
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