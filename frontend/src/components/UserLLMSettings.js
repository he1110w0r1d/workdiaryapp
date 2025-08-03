import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Select, 
  InputNumber, 
  Switch, 
  message, 
  Modal, 
  Table, 
  Space, 
  Popconfirm,
  Tag,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ExperimentOutlined,
  SettingOutlined
} from '@ant-design/icons';
import api from '../utils/api';

const { Option } = Select;

const UserLLMSettings = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [testLoading, setTestLoading] = useState(null);
  const [form] = Form.useForm();

  // 获取用户LLM配置列表
  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings/user-llm');
      console.log('=== API Response Debug ===');
      console.log('Full response:', response);
      console.log('Response data:', response.data);
      console.log('Configs array:', response.data.configs);
      
      const configs = response.data.configs || [];
      console.log('Configs length:', configs.length);
      configs.forEach((config, index) => {
        console.log(`Config ${index}:`, {
          _id: config._id,
          name: config.name,
          isDefault: config.isDefault,
          isDefaultType: typeof config.isDefault,
          allKeys: Object.keys(config)
        });
      });
      
      setConfigs(configs);
    } catch (error) {
      console.error('获取LLM配置失败:', error);
      message.error('获取LLM配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // 打开新增/编辑模态框
  const handleOpenModal = (config = null) => {
    setEditingConfig(config);
    setModalVisible(true);
    if (config) {
      form.setFieldsValue({
        ...config,
        apiKey: '' // 不显示已保存的密钥
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        provider: 'custom',
        timeout: 600000,
        temperature: 0.7,
        maxTokens: 8000,
        isDefault: false,
        isActive: true
      });
    }
  };

  // 关闭模态框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingConfig(null);
    form.resetFields();
  };

  // 保存配置
  const handleSave = async (values) => {
    try {
      setLoading(true);
      if (editingConfig) {
        // 更新配置
        await api.put(`/settings/user-llm/${editingConfig._id}`, values);
        message.success('LLM配置更新成功');
      } else {
        // 新增配置
        await api.post('/settings/user-llm', values);
        message.success('LLM配置保存成功');
      }
      handleCloseModal();
      fetchConfigs();
    } catch (error) {
      console.error('保存LLM配置失败:', error);
      message.error('保存LLM配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除配置
  const handleDelete = async (configId) => {
    try {
      await api.delete(`/settings/user-llm/${configId}`);
      message.success('LLM配置删除成功');
      fetchConfigs();
    } catch (error) {
      console.error('删除LLM配置失败:', error);
      message.error('删除LLM配置失败');
    }
  };

  // 测试配置
  const handleTest = async (configId) => {
    try {
      setTestLoading(configId);
      const response = await api.post(`/settings/user-llm/${configId}/test`);
      if (response.data.success) {
        message.success('LLM连接测试成功');
      } else {
        message.error(`LLM连接测试失败: ${response.data.message}`);
      }
    } catch (error) {
      console.error('测试LLM配置失败:', error);
      message.error('测试LLM配置失败');
    } finally {
      setTestLoading(null);
    }
  };

  // 设置为默认配置
  const handleSetDefault = async (configId, configName) => {
    Modal.confirm({
      title: '切换默认模型',
      content: `切换${configName}为默认模型吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.put(`/settings/user-llm/${configId}`, { isDefault: true });
          message.success('已设置为默认配置');
          fetchConfigs();
        } catch (error) {
          console.error('设置默认配置失败:', error);
          message.error('设置默认配置失败');
        }
      }
    });
  };

  // 根据提供商获取模型占位符
  const getModelPlaceholder = (provider) => {
    const placeholders = {
      openai: '例如: gpt-3.5-turbo, gpt-4',
      anthropic: '例如: claude-3-sonnet-20240229',
      custom: '例如: deepseek-ai/DeepSeek-V3',
      local: '例如: qwen3:4b'
    };
    return placeholders[provider] || '请输入模型名称';
  };

  // 表格列定义
  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        console.log('=== Name Column Render Debug ===');
        console.log('Text:', text);
        console.log('Record:', record);
        console.log('Record._id:', record._id);
        console.log('Record.isDefault:', record.isDefault);
        console.log('Record.isDefault type:', typeof record.isDefault);
        console.log('All record keys:', Object.keys(record));
        
        return (
          <div>
            <span style={{ backgroundColor: 'yellow', color: 'red', fontWeight: 'bold', padding: '2px 4px' }}>【测试标记】</span>
            <span>{text}</span>
            {record.isDefault && <span style={{ color: 'green', fontWeight: 'bold' }}> ★默认</span>}
            {!record.isActive && <Tag color="red">已禁用</Tag>}
          </div>
        );
      }
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider) => {
        const providerNames = {
          local: '本地LLM',
          openai: 'OpenAI',
          anthropic: 'Anthropic',
          custom: '自定义API'
        };
        return providerNames[provider] || provider;
      }
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model'
    },
    {
      title: 'API密钥',
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (apiKey) => apiKey ? '***已设置***' : '未设置'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => {
        console.log('=== Table Row Render Debug ===');
        console.log('Record:', record);
        console.log('Record._id:', record._id);
        console.log('Record.isDefault:', record.isDefault);
        console.log('Record.isDefault type:', typeof record.isDefault);
        console.log('Button disabled:', record.isDefault);
        console.log('Button text:', record.isDefault ? '已是默认' : '设为默认');
        
        return (
          <Space>
            <Button
              type="link"
              icon={<ExperimentOutlined />}
              loading={testLoading === record._id}
              onClick={() => handleTest(record._id)}
            >
              测试
            </Button>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
            >
              编辑
            </Button>

             <Popconfirm
                title="确定要删除这个配置吗？"
                onConfirm={() => handleDelete(record._id)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={configs.length <= 1}
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          );
        }
    }
  ];

  return (
    <Card
      title={
        <Space>
          <SettingOutlined /> 我的LLM配置
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModal()}
        >
          新增配置
        </Button>
      }
    >
      <Alert
        message="个人LLM配置"
        description="您可以配置多个LLM提供商，系统将使用默认配置生成工作总结。API密钥将被加密存储，确保安全性。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={configs}
        rowKey="_id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingConfig ? '编辑LLM配置' : '新增LLM配置'}
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如: 工作总结专用" />
          </Form.Item>

          <Form.Item
            name="provider"
            label="LLM提供商"
            rules={[{ required: true, message: '请选择LLM提供商' }]}
          >
            <Select placeholder="请选择提供商">
              <Option value="local">本地LLM</Option>
              <Option value="openai">OpenAI</Option>
              <Option value="anthropic">Anthropic</Option>
              <Option value="custom">自定义API</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.provider !== currentValues.provider}
          >
            {({ getFieldValue }) => {
              const provider = getFieldValue('provider');
              
              return (
                <>
                  {provider !== 'local' && (
                    <Form.Item
                      name="apiKey"
                      label="API密钥"
                      rules={[{ required: !editingConfig, message: '请输入API密钥' }]}
                    >
                      <Input.Password 
                        placeholder={editingConfig ? '留空表示不修改密钥' : '请输入API密钥'} 
                      />
                    </Form.Item>
                  )}

                  <Form.Item
                    name="apiUrl"
                    label="API地址"
                    rules={[{ required: true, message: '请输入API地址' }]}
                  >
                    <Input 
                      placeholder={
                        provider === 'local' 
                          ? 'http://localhost:11434/api/generate'
                          : provider === 'openai'
                          ? 'https://api.openai.com/v1/chat/completions'
                          : provider === 'anthropic'
                          ? 'https://api.anthropic.com/v1/messages'
                          : 'https://api.siliconflow.cn/v1/chat/completions'
                      }
                    />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.provider !== currentValues.provider}
          >
            {({ getFieldValue }) => {
              const provider = getFieldValue('provider');
              
              return (
                <Form.Item
                  name="model"
                  label="模型名称"
                  rules={[{ required: true, message: '请输入模型名称' }]}
                >
                  <Input placeholder={getModelPlaceholder(provider)} />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            name="timeout"
            label="请求超时时间(毫秒)"
            rules={[{ required: true, message: '请输入超时时间' }]}
          >
            <InputNumber 
              min={1000} 
              max={600000} 
              step={1000} 
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="temperature"
            label="温度参数"
            rules={[{ required: true, message: '请输入温度参数' }]}
          >
            <InputNumber 
              min={0} 
              max={2} 
              step={0.1} 
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="maxTokens"
            label="最大Token数"
            rules={[{ required: true, message: '请输入最大Token数' }]}
          >
            <InputNumber 
              min={100} 
              max={32000} 
              step={100} 
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="isDefault"
            label="设为默认配置"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="启用此配置"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingConfig ? '更新配置' : '保存配置'}
              </Button>
              <Button onClick={handleCloseModal}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserLLMSettings;