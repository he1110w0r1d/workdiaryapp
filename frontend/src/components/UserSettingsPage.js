import React, { useState } from 'react';
import { Tabs, Card, Space } from 'antd';
import { UserOutlined, SettingOutlined, ToolOutlined } from '@ant-design/icons';
import UserSettings from './UserSettings';
import UserLLMSettings from './UserLLMSettings';

const { TabPane } = Tabs;

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
          <ToolOutlined />
          LLM配置
        </Space>
      ),
      children: <UserLLMSettings />
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
        bodyStyle={{ padding: 0 }}
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