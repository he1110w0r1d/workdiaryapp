import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Popconfirm,
  Typography,
  Tag,
  Tooltip,
  InputNumber,
  Tabs
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  LinkOutlined,
  RobotOutlined,
  EyeInvisibleOutlined,
  ThunderboltOutlined,
  SaveOutlined,
  SyncOutlined
} from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

const ModelSettings = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [testLoading, setTestLoading] = useState(null);
  const [form] = Form.useForm();
  const [embForm] = Form.useForm();
  const [embSettings, setEmbSettings] = useState(null);
  const [embLoading, setEmbLoading] = useState(false);
  const [embTestLoading, setEmbTestLoading] = useState(false);
  
  // 当模态框显示时，再同步编辑表单内容，避免未绑定警告
  useEffect(() => {
    if (modalVisible) {
      if (editingModel) {
        form.setFieldsValue({
          name: editingModel.name,
          provider: editingModel.provider,
          apiKey: editingModel.apiKey,
          apiUrl: editingModel.apiUrl,
          model: editingModel.model
        });
      } else {
        form.resetFields();
      }
    }
  }, [modalVisible, editingModel, form]);

  useEffect(() => {
    fetchModels();
    // 获取嵌入模型设置
    const fetchEmbeddingsSettings = async () => {
      try {
        setEmbLoading(true);
        const response = await api.get('/settings/llm');
        // 仅提取嵌入相关字段
        const s = response.data || {};
        const emb = {
          externalEmbeddingsProvider: s.externalEmbeddingsProvider || 'siliconflow',
          externalEmbeddingsApiKey: s.externalEmbeddingsApiKey || '',
          externalEmbeddingsApiUrl: s.externalEmbeddingsApiUrl || '',
          externalEmbeddingsModel: s.externalEmbeddingsModel || 'bge-m3',
          externalEmbeddingsTimeout: s.externalEmbeddingsTimeout || 60000,
        };
        setEmbSettings(emb);
      } catch (error) {
        console.error('获取嵌入模型设置失败:', error);
        message.error('获取嵌入模型设置失败');
        const emb = {
          externalEmbeddingsProvider: 'siliconflow',
          externalEmbeddingsApiKey: '',
          externalEmbeddingsApiUrl: '',
          externalEmbeddingsModel: 'bge-m3',
          externalEmbeddingsTimeout: 60000,
        };
        setEmbSettings(emb);
      } finally {
        setEmbLoading(false);
      }
    };
    fetchEmbeddingsSettings();
  }, [embForm]);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await api.get('/settings/user-llm');
      setModels(response.data.configs || []);
    } catch (error) {
      console.error('获取模型配置失败:', error);
      message.error('获取模型配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingModel(null);
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingModel(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/settings/user-llm/${id}`);
      message.success('删除成功');
      fetchModels();
    } catch (error) {
      console.error('删除模型配置失败:', error);
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingModel) {
        await api.put(`/settings/user-llm/${editingModel._id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/settings/user-llm', values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchModels();
    } catch (error) {
      console.error('保存模型配置失败:', error);
      message.error('保存失败');
    }
  };

  const handleSetDefault = async (configId, configName) => {
    try {
      await api.put(`/settings/user-llm/${configId}/set-default`);
      message.success(`已将 "${configName}" 设置为默认配置`);
      fetchModels();
    } catch (error) {
      console.error('设置默认配置失败:', error);
      message.error('设置默认配置失败');
    }
  };

  const handleTest = async (configId) => {
    try {
      setTestLoading(configId);
      const response = await api.post(`/settings/user-llm/${configId}/test`);
      if (response.data.success) {
        message.success('连接测试成功: ' + response.data.message);
      } else {
        message.error('连接测试失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('测试LLM配置失败:', error);
      message.error('连接测试失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setTestLoading(null);
    }
  };

  const maskApiKey = (apiKey) => {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return apiKey;
    return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
  };

  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <div
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: record.isDefault ? '#52c41a' : '#f0f0f0',
              border: record.isDefault ? '2px solid #52c41a' : '2px solid #d9d9d9',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
            onClick={() => handleSetDefault(record._id, record.name)}
          >
            {record.isDefault ? '✓' : ''}
          </div>
          <RobotOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
          {record.isDefault && <Tag color="green">默认</Tag>}
        </Space>
      )
    },
    {
      title: '服务商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider) => {
        const colors = {
          'openai': 'green',
          'anthropic': 'blue',
          'local': 'purple',
          'custom': 'orange'
        };
        return <Tag color={colors[provider] || 'default'}>{provider.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'API密钥',
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (apiKey) => (
        <Space>
          <EyeInvisibleOutlined style={{ color: '#999' }} />
          <Text code>{maskApiKey(apiKey)}</Text>
        </Space>
      )
    },
    {
      title: '连接URL',
      dataIndex: 'apiUrl',
      key: 'apiUrl',
      render: (url) => (
        <Tooltip title={url}>
          <Space>
            <LinkOutlined style={{ color: '#1890ff' }} />
            <Text ellipsis style={{ maxWidth: 200 }}>{url}</Text>
          </Space>
        </Tooltip>
      )
    },
    {
      title: '模型名称',
      dataIndex: 'model',
      key: 'model',
      render: (model) => (
        <Space>
          <ApiOutlined style={{ color: '#52c41a' }} />
          <Text>{model}</Text>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<ThunderboltOutlined />}
            onClick={() => handleTest(record._id)}
            loading={testLoading === record._id}
            size="small"
          >
            测试
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个模型配置吗？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
            placement="topRight"
            overlayStyle={{ zIndex: 9999 }}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const handleSaveEmbeddings = async () => {
    try {
      setEmbLoading(true);
      const values = await embForm.validateFields();
      const payload = {
        externalEmbeddingsProvider: values.externalEmbeddingsProvider,
        externalEmbeddingsApiKey: values.externalEmbeddingsApiKey,
        externalEmbeddingsApiUrl: values.externalEmbeddingsApiUrl || '',
        externalEmbeddingsModel: values.externalEmbeddingsModel,
        externalEmbeddingsTimeout: values.externalEmbeddingsTimeout || 60000,
      };
      await api.post('/settings/llm', payload);
      message.success('嵌入设置已保存');
      setEmbSettings(payload);
    } catch (error) {
      console.error('保存嵌入设置失败:', error);
      message.error('保存嵌入设置失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setEmbLoading(false);
    }
  };

  const handleTestEmbeddings = async () => {
    try {
      setEmbTestLoading(true);
      const values = await embForm.validateFields();
      const payload = {
        externalEmbeddingsProvider: values.externalEmbeddingsProvider,
        externalEmbeddingsApiKey: values.externalEmbeddingsApiKey,
        externalEmbeddingsApiUrl: values.externalEmbeddingsApiUrl || '',
        externalEmbeddingsModel: values.externalEmbeddingsModel,
        externalEmbeddingsTimeout: values.externalEmbeddingsTimeout || 60000,
      };
      const response = await api.post('/settings/embeddings/test', payload);
      if (response.data?.success) {
        message.success(`嵌入连接测试成功，向量维度: ${response.data.vectorDimensions ?? '未知'}`);
      } else {
        message.error('嵌入连接测试失败: ' + (response.data?.message || '未知错误'));
      }
    } catch (error) {
      console.error('测试嵌入配置失败:', error);
      message.error('嵌入连接测试失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setEmbTestLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Tabs
          defaultActiveKey="models"
          items={[
            {
              key: 'models',
              label: '模型设置',
              children: (
                <div>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>模型设置</Title>
                      <Text type="secondary">管理您的AI模型配置，包括API密钥、连接URL和模型参数</Text>
                    </div>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleAdd}
                    >
                      添加模型
                    </Button>
                  </div>

                  <Table
                    columns={columns}
                    dataSource={models}
                    rowKey="_id"
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 个配置`
                    }}
                    locale={{
                      emptyText: '暂无模型配置，点击"添加模型"开始配置'
                    }}
                  />
                </div>
              )
            },
            {
              key: 'embeddings',
              label: '词嵌入模型',
              children: (
                <div>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>词嵌入模型设置</Title>
                      <Text type="secondary">配置用于RAG索引/查询的词向量嵌入服务（推荐：硅基流动）</Text>
                    </div>
                    <Space>
                      <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveEmbeddings} loading={embLoading}>保存设置</Button>
                      <Button icon={<SyncOutlined />} onClick={handleTestEmbeddings} loading={embTestLoading}>测试嵌入</Button>
                    </Space>
                  </div>
                  <Form
                    key={embSettings ? `${embSettings.externalEmbeddingsProvider}-${embSettings.externalEmbeddingsModel}` : 'emb-empty'}
                    form={embForm}
                    layout="vertical"
                    initialValues={embSettings || {}}
                  >
                    <Form.Item name="externalEmbeddingsProvider" label="嵌入提供商" rules={[{ required: true, message: '请选择嵌入提供商' }]}>
                      <Select placeholder="选择嵌入提供商">
                        <Option value="siliconflow">硅基流动</Option>
                        <Option value="openai">OpenAI</Option>
                        <Option value="openrouter">OpenRouter</Option>
                        <Option value="custom">自定义API</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item name="externalEmbeddingsApiKey" label="API密钥" rules={[{ required: true, message: '请输入API密钥' }]}>
                      <Input.Password placeholder="输入嵌入服务API密钥" />
                    </Form.Item>

                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.externalEmbeddingsProvider !== cur.externalEmbeddingsProvider}>
                      {({ getFieldValue }) => (
                        getFieldValue('externalEmbeddingsProvider') === 'custom' ? (
                          <Form.Item name="externalEmbeddingsApiUrl" label="自定义API地址" rules={[{ required: true, message: '请输入API地址' }]}>
                            <Input placeholder="例如: https://api.example.com/v1/embeddings" />
                          </Form.Item>
                        ) : null
                      )}
                    </Form.Item>

                    <Form.Item name="externalEmbeddingsModel" label="嵌入模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
                      <Input placeholder="例如: text-embedding-3-large, bge-m3" />
                    </Form.Item>

                    <Form.Item name="externalEmbeddingsTimeout" label="请求超时时间(毫秒)" rules={[{ required: true, message: '请输入超时时间' }]}>
                      <InputNumber min={1000} max={600000} step={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Form>
                </div>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editingModel ? '编辑模型配置' : '添加模型配置'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如：GPT-4 生产环境" />
          </Form.Item>

          <Form.Item
            name="provider"
            label="服务商"
            rules={[{ required: true, message: '请选择服务商' }]}
          >
            <Select placeholder="选择AI服务商">
              <Option value="openai">OpenAI</Option>
              <Option value="anthropic">Anthropic (Claude)</Option>
              <Option value="openrouter">OpenRouter</Option>
              <Option value="deepseek">DeepSeek</Option>
              <Option value="qwen">Qwen (通义千问)</Option>
              <Option value="doubao">豆包 (字节跳动)</Option>
              <Option value="siliconflow">硅基流动</Option>
              <Option value="zhipu">智谱AI</Option>
              <Option value="local">本地部署</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.provider !== currentValues.provider}
          >
            {({ getFieldValue }) => {
              const provider = getFieldValue('provider');
              const getApiUrl = () => {
                const urls = {
                  openai: 'https://api.openai.com/v1/chat/completions',
                  anthropic: 'https://api.anthropic.com/v1/messages',
                  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
                  deepseek: 'https://api.deepseek.com/v1/chat/completions',
                  qwen: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
                  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
                  local: 'http://localhost:11434/api/generate',
                  custom: 'https://api.example.com/v1/chat/completions'
                };
                return urls[provider] || 'https://api.example.com/v1/chat/completions';
              };
              
              // 当提供商改变时，自动设置URL
              const currentApiUrl = getFieldValue('apiUrl');
              const defaultApiUrl = getApiUrl();
              if (!currentApiUrl || currentApiUrl === '' || currentApiUrl.includes('example.com')) {
                form.setFieldsValue({ apiUrl: defaultApiUrl });
              }
              
              return (
                <>
                  <Form.Item
                    name="apiKey"
                    label="API密钥"
                    rules={[{ required: true, message: '请输入API密钥' }]}
                  >
                    <Input.Password placeholder="输入您的API密钥" />
                  </Form.Item>

                  <Form.Item
                    name="apiUrl"
                    label="连接URL"
                    rules={[
                      { required: true, message: '请输入API连接URL' },
                      { type: 'url', message: '请输入有效的URL' }
                    ]}
                  >
                    <Input placeholder={defaultApiUrl} />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>

          <Form.Item
            name="model"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如：gpt-4, claude-3-sonnet" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingModel ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelSettings;