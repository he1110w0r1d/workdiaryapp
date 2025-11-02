import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Select, InputNumber, Switch, message, Modal, Table, Space, Tag, Popconfirm, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExperimentOutlined, StarOutlined } from '@ant-design/icons';
import api from '../utils/api';
import Logger from '../utils/logger';

const { Option } = Select;

const UserEmbeddingsSettings = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [testLoading, setTestLoading] = useState(null);
  const [form] = Form.useForm();

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings/user-embeddings');
      Logger.api('获取用户嵌入配置列表成功:', response.data);
      setConfigs(response.data.configs || []);
    } catch (error) {
      console.error('获取用户嵌入配置失败:', error);
      message.error('获取用户嵌入配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (modalVisible) {
      if (editingConfig) {
        form.setFieldsValue({
          name: editingConfig.name || '',
          provider: editingConfig.provider || 'siliconflow',
          apiKey: editingConfig.apiKey || '',
          apiUrl: editingConfig.apiUrl || '',
          model: editingConfig.model || 'bge-m3',
          timeout: editingConfig.timeout || 60000,
          isDefault: !!editingConfig.isDefault,
          isActive: editingConfig.isActive !== false
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          name: '',
          provider: 'siliconflow',
          apiKey: '',
          apiUrl: 'https://api.siliconflow.cn/v1/embeddings',
          model: 'bge-m3',
          timeout: 60000,
          isDefault: false,
          isActive: true
        });
      }
    }
  }, [modalVisible, editingConfig, form]);

  const handleOpenModal = (config = null) => {
    setEditingConfig(config);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingConfig(null);
  };

  const handleSave = async (values) => {
    try {
      if (editingConfig) {
        const res = await api.put(`/settings/user-embeddings/${editingConfig._id}`, values);
        message.success('嵌入配置更新成功');
        Logger.api('更新用户嵌入配置成功:', res.data);
      } else {
        const res = await api.post('/settings/user-embeddings', values);
        message.success('嵌入配置保存成功');
        Logger.api('保存用户嵌入配置成功:', res.data);
      }
      handleCloseModal();
      fetchConfigs();
    } catch (error) {
      console.error('保存嵌入配置失败:', error);
      message.error('保存嵌入配置失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (config) => {
    try {
      await api.delete(`/settings/user-embeddings/${config._id}`);
      message.success('配置删除成功');
      fetchConfigs();
    } catch (error) {
      console.error('删除嵌入配置失败:', error);
      message.error('删除嵌入配置失败');
    }
  };

  const handleSetDefault = async (config) => {
    try {
      await api.put(`/settings/user-embeddings/${config._id}/set-default`);
      message.success('设置默认嵌入配置成功');
      fetchConfigs();
    } catch (error) {
      console.error('设置默认嵌入配置失败:', error);
      message.error('设置默认失败');
    }
  };

  const handleTest = async (config) => {
    try {
      setTestLoading(config._id);
      const res = await api.post(`/settings/user-embeddings/${config._id}/test`);
      if (res.data?.success) {
        message.success(`嵌入连接测试成功，向量维度: ${res.data.vectorDimensions ?? '未知'}`);
      } else {
        message.error('嵌入连接测试失败: ' + (res.data?.message || '未知错误'));
      }
    } catch (error) {
      console.error('测试嵌入配置失败:', error);
      message.error('测试失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setTestLoading(null);
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const displayText = text === '默认嵌入配置' ? '' : text;
        return (
          <Space>
            {displayText && <span>{displayText}</span>}
            {record.isDefault && <Tag color="blue">默认</Tag>}
            {record.isActive ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
          </Space>
        );
      }
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (p) => (
        <Tag color="purple">{p}</Tag>
      )
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model'
    },
    {
      title: 'API地址',
      dataIndex: 'apiUrl',
      key: 'apiUrl',
      render: (url) => <span style={{ color: '#666' }}>{String(url || '').substring(0, 40)}{url && url.length > 40 ? '...' : ''}</span>
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>编辑</Button>
          <Button icon={<StarOutlined />} onClick={() => handleSetDefault(record)} disabled={record.isDefault}>设为默认</Button>
          <Button icon={<ExperimentOutlined />} loading={testLoading === record._id} onClick={() => handleTest(record)}>测试</Button>
          <Popconfirm title="确认删除该配置？" onConfirm={() => handleDelete(record)}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const ProviderDependentFields = ({ provider }) => {
    const getApiUrl = () => {
      const urls = {
        openai: 'https://api.openai.com/v1/embeddings',
        openrouter: 'https://openrouter.ai/api/v1/embeddings',
        siliconflow: 'https://api.siliconflow.cn/v1/embeddings',
        custom: 'https://api.example.com/v1/embeddings'
      };
      return urls[provider] || 'https://api.example.com/v1/embeddings';
    };
    const getModelPlaceholder = () => {
      const placeholders = {
        openai: '例如: text-embedding-3-large',
        openrouter: '例如: openai/text-embedding-3-large',
        siliconflow: '例如: bge-m3',
        custom: '请输入模型名称'
      };
      return placeholders[provider] || '请输入模型名称';
    };
    return (
      <>
        <Form.Item name="apiKey" label="API密钥" rules={[{ required: true, message: '请输入API密钥' }]}>
          <Input.Password placeholder="输入您的API密钥" />
        </Form.Item>
        <Form.Item name="apiUrl" label="连接URL" rules={[{ required: true, message: '请输入API连接URL' }, { type: 'url', message: '请输入有效的URL' }]}>
          <Input placeholder={getApiUrl()} />
        </Form.Item>
        <Form.Item name="model" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
          <Input placeholder={getModelPlaceholder()} />
        </Form.Item>
      </>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>用户嵌入设置</h3>
          <span style={{ color: '#666' }}>为当前用户配置用于RAG索引/查询的词向量嵌入服务</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>新增配置</Button>
      </div>

      <Alert
        description="系统将优先使用您的默认嵌入配置进行向量生成。如果未设置，将回退到全局嵌入配置。"
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
        title={editingConfig ? '编辑嵌入配置' : '新增嵌入配置'}
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入配置名称' }]}>
            <Input placeholder="例如: RAG嵌入服务" />
          </Form.Item>
          <Form.Item name="provider" label="嵌入提供商" rules={[{ required: true, message: '请选择嵌入提供商' }]}> 
            <Select placeholder="请选择提供商">
              <Option value="openai">OpenAI</Option>
              <Option value="openrouter">OpenRouter</Option>
              <Option value="siliconflow">硅基流动</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.provider !== curr.provider}>
            {({ getFieldValue }) => {
              const provider = getFieldValue('provider');
              return <ProviderDependentFields provider={provider || 'siliconflow'} />;
            }}
          </Form.Item>
          <Form.Item name="timeout" label="请求超时时间(ms)">
            <InputNumber min={1000} max={600000} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isDefault" label="设为默认" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isActive" label="是否启用" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Button onClick={handleCloseModal} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default UserEmbeddingsSettings;