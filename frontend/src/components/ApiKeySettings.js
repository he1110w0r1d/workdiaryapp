import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Select, 
  message, 
  Modal, 
  Table, 
  Space, 
  Popconfirm,
  Tag,
  Alert,
  Typography,
  DatePicker,
  Switch,
  Descriptions
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  CopyOutlined,
  KeyOutlined,
  ApiOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text, Paragraph } = Typography;

const SCOPE_OPTIONS = [
  { value: 'all', label: '全部权限', description: '读写所有数据' },
  { value: 'diary:read', label: '日记读取', description: '读取日记数据' },
  { value: 'diary:write', label: '日记写入', description: '创建/修改/删除日记' },
  { value: 'todo:read', label: '待办读取', description: '读取待办数据' },
  { value: 'todo:write', label: '待办写入', description: '创建/修改待办' },
  { value: 'summary:read', label: '总结读取', description: '读取工作总结' }
];

const ApiKeySettings = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newKeyModalVisible, setNewKeyModalVisible] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await api.get('/apikeys');
      setApiKeys(response.data.apiKeys || []);
    } catch (error) {
      console.error('获取API Key列表失败:', error);
      message.error('获取API Key列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleOpenModal = () => {
    setModalVisible(true);
    form.resetFields();
    form.setFieldsValue({
      scopes: ['all'],
      expiresAt: null
    });
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    form.resetFields();
  };

  const handleCreate = async (values) => {
    try {
      setLoading(true);
      const payload = {
        name: values.name,
        scopes: values.scopes,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null
      };
      
      const response = await api.post('/apikeys', payload);
      
      setNewApiKey(response.data.apiKey.key);
      setNewKeyModalVisible(true);
      handleCloseModal();
      fetchApiKeys();
      message.success('API Key创建成功');
    } catch (error) {
      console.error('创建API Key失败:', error);
      message.error(error.response?.data?.message || '创建API Key失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/apikeys/${id}`);
      message.success('API Key已删除');
      fetchApiKeys();
    } catch (error) {
      console.error('删除API Key失败:', error);
      message.error('删除API Key失败');
    }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      await api.put(`/apikeys/${id}/toggle`);
      message.success(currentStatus ? 'API Key已禁用' : 'API Key已启用');
      fetchApiKeys();
    } catch (error) {
      console.error('切换API Key状态失败:', error);
      message.error('切换状态失败');
    }
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        message.success('已复制到剪贴板');
      }).catch(() => {
        message.error('复制失败');
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        message.success('已复制到剪贴板');
      } catch (err) {
        message.error('复制失败');
      }
      document.body.removeChild(textArea);
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <KeyOutlined />
          <span>{text}</span>
          {!record.isActive && <Tag color="red">已禁用</Tag>}
        </Space>
      )
    },
    {
      title: 'Key前缀',
      dataIndex: 'keyPrefix',
      key: 'keyPrefix',
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: '权限',
      dataIndex: 'scopes',
      key: 'scopes',
      render: (scopes) => (
        <Space wrap>
          {scopes.map(scope => {
            const option = SCOPE_OPTIONS.find(o => o.value === scope);
            return (
              <Tag key={scope} color="blue">
                {option ? option.label : scope}
              </Tag>
            );
          })}
        </Space>
      )
    },
    {
      title: '使用统计',
      key: 'usage',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text type="secondary">调用次数: {record.usageCount}</Text>
          <Text type="secondary">
            最后使用: {record.lastUsedAt ? dayjs(record.lastUsedAt).format('YYYY-MM-DD HH:mm') : '从未'}
          </Text>
        </Space>
      )
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (expiresAt) => {
        if (!expiresAt) return <Tag color="green">永不过期</Tag>;
        const isExpired = new Date(expiresAt) < new Date();
        return (
          <Tag color={isExpired ? 'red' : 'orange'}>
            {isExpired ? '已过期' : dayjs(expiresAt).format('YYYY-MM-DD')}
          </Tag>
        );
      }
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => (
        <Switch
          checked={record.isActive}
          onChange={() => handleToggle(record.id, record.isActive)}
          checkedChildren={<CheckCircleOutlined />}
          unCheckedChildren={<CloseCircleOutlined />}
        />
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="确定要删除这个API Key吗？"
          description="删除后将无法恢复，使用此Key的所有请求都会失败。"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
          >
            删除
          </Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <Card
      title={
        <Space>
          <ApiOutlined /> API Key管理
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => setDocModalVisible(true)}
          >
            API文档
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenModal}
          >
            创建API Key
          </Button>
        </Space>
      }
    >
      <Alert
        message="API Key用于外部应用接入"
        description={
          <span>
            创建API Key后，其他AI Agent或应用可以通过API接口访问您的工作日记数据。
            请妥善保管API Key，不要泄露给他人。
            <Button type="link" onClick={() => setDocModalVisible(true)}>查看API文档</Button>
          </span>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={apiKeys}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: '暂无API Key，点击上方按钮创建' }}
      />

      <Modal
        title="创建API Key"
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="name"
            label="Key名称"
            rules={[{ required: true, message: '请输入API Key名称' }]}
          >
            <Input placeholder="例如：工作流自动化、AI助手" />
          </Form.Item>

          <Form.Item
            name="scopes"
            label="权限范围"
            rules={[{ required: true, message: '请选择至少一个权限' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择API Key的权限范围"
              optionLabelProp="label"
            >
              {SCOPE_OPTIONS.map(option => (
                <Option key={option.value} value={option.value} label={option.label}>
                  <Space>
                    <span>{option.label}</span>
                    <Text type="secondary">- {option.description}</Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="expiresAt"
            label="过期时间"
            extra="留空表示永不过期"
          >
            <DatePicker 
              style={{ width: '100%' }} 
              placeholder="选择过期日期（可选）"
              disabledDate={(current) => current && current < dayjs().endOf('day')}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建
              </Button>
              <Button onClick={handleCloseModal}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            API Key已创建
          </Space>
        }
        open={newKeyModalVisible}
        onCancel={() => setNewKeyModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={() => copyToClipboard(newApiKey)}>
            复制Key
          </Button>,
          <Button key="close" onClick={() => setNewKeyModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <Alert
          message="请立即保存此API Key"
          description="API Key只会显示一次，关闭此窗口后将无法再次查看完整的Key。请确保已安全保存。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ 
          background: '#f5f5f5', 
          padding: '16px', 
          borderRadius: '4px',
          wordBreak: 'break-all',
          fontFamily: 'monospace'
        }}>
          {newApiKey}
        </div>
      </Modal>

      <Modal
        title="API文档"
        open={docModalVisible}
        onCancel={() => setDocModalVisible(false)}
        footer={null}
        width={800}
      >
        <ApiDocumentation />
      </Modal>
    </Card>
  );
};

const ApiDocumentation = () => {
  const baseUrl = `${window.location.protocol}//${window.location.hostname}:5000/api/v1`;
  
  return (
    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      <Alert
        message="API认证"
        description={
          <span>
            所有API请求需要在Header中携带 <Text code>X-API-Key</Text> 进行认证。
          </span>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Descriptions title="基础信息" bordered column={1} size="small">
        <Descriptions.Item label="Base URL">
          <Text code copyable>{baseUrl}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="认证方式">
          <Text code>X-API-Key: wdk_your_api_key</Text>
        </Descriptions.Item>
        <Descriptions.Item label="响应格式">JSON</Descriptions.Item>
      </Descriptions>

      <Card title="日记相关接口" size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Tag color="green">GET</Tag>
            <Text code>/diaries</Text>
            <Text type="secondary"> - 获取日记列表</Text>
            <Paragraph type="secondary" style={{ marginLeft: 50, marginTop: 4 }}>
              参数: startDate, endDate, search, tags, priority, page, limit, sort
            </Paragraph>
          </div>
          <div>
            <Tag color="green">GET</Tag>
            <Text code>/diaries/:id</Text>
            <Text type="secondary"> - 获取单个日记详情</Text>
          </div>
          <div>
            <Tag color="blue">POST</Tag>
            <Text code>/diaries</Text>
            <Text type="secondary"> - 创建新日记</Text>
            <Paragraph type="secondary" style={{ marginLeft: 50, marginTop: 4 }}>
              必填: content, startTime, endTime
            </Paragraph>
          </div>
          <div>
            <Tag color="orange">PUT</Tag>
            <Text code>/diaries/:id</Text>
            <Text type="secondary"> - 更新日记</Text>
          </div>
          <div>
            <Tag color="red">DELETE</Tag>
            <Text code>/diaries/:id</Text>
            <Text type="secondary"> - 删除日记</Text>
          </div>
        </Space>
      </Card>

      <Card title="待办相关接口" size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Tag color="green">GET</Tag>
            <Text code>/todos</Text>
            <Text type="secondary"> - 获取待办列表</Text>
            <Paragraph type="secondary" style={{ marginLeft: 50, marginTop: 4 }}>
              参数: status, priority, page, limit, sort
            </Paragraph>
          </div>
          <div>
            <Tag color="blue">POST</Tag>
            <Text code>/todos</Text>
            <Text type="secondary"> - 创建待办</Text>
            <Paragraph type="secondary" style={{ marginLeft: 50, marginTop: 4 }}>
              必填: content, dueDate
            </Paragraph>
          </div>
          <div>
            <Tag color="orange">PUT</Tag>
            <Text code>/todos/:id/status</Text>
            <Text type="secondary"> - 更新待办状态</Text>
            <Paragraph type="secondary" style={{ marginLeft: 50, marginTop: 4 }}>
              状态值: 待办, 已完成, 已放弃, 已转交
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Card title="总结相关接口" size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Tag color="green">GET</Tag>
            <Text code>/summaries</Text>
            <Text type="secondary"> - 获取总结列表</Text>
            <Paragraph type="secondary" style={{ marginLeft: 50, marginTop: 4 }}>
              参数: type (daily/weekly/monthly/yearly), page, limit
            </Paragraph>
          </div>
          <div>
            <Tag color="green">GET</Tag>
            <Text code>/summaries/:id</Text>
            <Text type="secondary"> - 获取总结详情</Text>
          </div>
        </Space>
      </Card>

      <Card title="其他接口" size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Tag color="green">GET</Tag>
            <Text code>/tags</Text>
            <Text type="secondary"> - 获取所有标签</Text>
          </div>
          <div>
            <Tag color="green">GET</Tag>
            <Text code>/stats</Text>
            <Text type="secondary"> - 获取统计数据</Text>
          </div>
        </Space>
      </Card>

      <Card title="请求示例" size="small" style={{ marginTop: 16 }}>
        <Paragraph>
          <Text strong>创建日记示例：</Text>
        </Paragraph>
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto' }}>
{`curl -X POST "${baseUrl}/diaries" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: wdk_your_api_key" \\
  -d '{
    "content": "今天完成了API开发工作",
    "startTime": "2024-01-01T09:00:00Z",
    "endTime": "2024-01-01T18:00:00Z",
    "tags": ["开发", "API"],
    "workPriority": "高"
  }'`}
        </pre>
      </Card>
    </div>
  );
};

export default ApiKeySettings;
