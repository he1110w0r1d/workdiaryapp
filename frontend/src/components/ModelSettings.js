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
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  LinkOutlined,
  RobotOutlined,
  EyeInvisibleOutlined,
  ThunderboltOutlined
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

  useEffect(() => {
    fetchModels();
  }, []);

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
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingModel(record);
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      apiKey: record.apiKey,
      apiUrl: record.apiUrl,
      model: record.model
    });
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

  return (
    <div style={{ padding: '24px' }}>
      <Card>
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
              <Option value="anthropic">Anthropic</Option>
              <Option value="local">本地部署</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>

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
            <Input placeholder="https://api.openai.com/v1" />
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