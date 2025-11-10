import React, { useState, useEffect } from 'react';
import { 
  List, 
  Card, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  message, 
  Empty,
  Spin,
  Typography,
  Tabs
} from 'antd';
import { 
  CheckOutlined, 
  CloseOutlined, 
  SwapOutlined,
  CalendarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import moment from 'moment';

const { Title, Text } = Typography;
const { TextArea } = Input;

const TodoList = () => {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [actionType, setActionType] = useState('');
  const [form] = Form.useForm();

  // 获取待办列表
  const fetchTodos = async () => {
    setLoading(true);
    try {
      // 请求全部状态的列表，并提高limit避免分页遗漏
      const response = await api.get('/todos?limit=1000');
      const list = response.data.todos || [];
      setTodos(list);
      // 将待处理数量同步到导航栏
      try {
        const pendingCount = Array.isArray(list) ? list.filter(t => t.status === '待办').length : 0;
        window.dispatchEvent(new CustomEvent('todosCountUpdated', { detail: pendingCount }));
      } catch (e) {
        // 忽略事件分发错误，避免影响主流程
        console.warn('同步待办数量事件失败:', e);
      }
    } catch (error) {
      console.error('获取待办列表失败:', error);
      message.error('获取待办列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  // 处理待办状态更新
  const handleTodoAction = async (values) => {
    try {
      const { summary } = values;
      await api.put(`/todos/${selectedTodo._id}/status`, {
        status: actionType,
        summary
      });
      
      message.success(`待办已${getActionText(actionType)}`);
      setActionModalVisible(false);
      form.resetFields();
      fetchTodos(); // 重新获取列表
      
      // 触发自定义事件，通知其他组件待办状态已更新
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (error) {
      console.error('更新待办状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 获取操作文本
  const getActionText = (type) => {
    switch (type) {
      case '已完成': return '完成';
      case '已放弃': return '放弃';
      case '已转交': return '转交';
      default: return '处理';
    }
  };



  // 获取状态显示
  const getStatusDisplay = (status) => {
    switch (status) {
      case '待办':
        return { color: 'processing', emoji: '⏳', text: '待处理' };
      case '已完成':
        return { color: 'success', emoji: '✅', text: '已完成' };
      case '已放弃':
        return { color: 'default', emoji: '❌', text: '已放弃' };
      case '已转交':
        return { color: 'warning', emoji: '🔄', text: '已转交' };
      default:
        return { color: 'processing', emoji: '⏳', text: '待处理' };
    }
  };

  // 打开操作弹窗
  const openActionModal = (todo, type) => {
    setSelectedTodo(todo);
    setActionType(type);
    setActionModalVisible(true);
  };

  // 渲染已处理待办项的通用函数
  const renderProcessedTodoItem = (todo) => {
    const statusDisplay = getStatusDisplay(todo.status);
    
    return (
      <List.Item
        style={{
          border: '1px solid #f0f0f0',
          borderRadius: '8px',
          marginBottom: '12px',
          padding: '16px',
          backgroundColor: '#f9f9f9',
          opacity: 0.8
        }}
      >
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>
                {todo.content}
              </Text>
              <Space size="middle">
                <Tag color={statusDisplay.color}>
                  {statusDisplay.emoji} {statusDisplay.text}
                </Tag>
              </Space>
              
              {/* 显示最新状态变更的简述 */}
              {todo.statusHistory && todo.statusHistory.length > 0 && (() => {
                const latestHistory = todo.statusHistory[todo.statusHistory.length - 1];
                return latestHistory.reason && (
                  <div style={{ 
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#f0f8ff',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
                      📝 处理简述：
                    </Text>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#333',
                      marginTop: '4px',
                      fontStyle: 'italic'
                    }}>
                      "{latestHistory.reason}"
                    </div>
                  </div>
                );
              })()}
              
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  处理时间: {moment(todo.updatedAt).format('YYYY-MM-DD HH:mm')}
                </Text>
              </div>
            </div>
          </div>
        </div>
      </List.Item>
    );
  };

  // 过滤待处理的待办
  const pendingTodos = todos.filter(todo => todo.status === '待办');
  const completedTodos = todos.filter(todo => todo.status === '已完成');
  const abandonedTodos = todos.filter(todo => todo.status === '已放弃');
  const transferredTodos = todos.filter(todo => todo.status === '已转交');

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '24px' }}>
        <img 
          src={process.env.PUBLIC_URL + '/pic/todo.png'} 
          alt="待办管理"
          style={{ 
            height: '80px', 
            width: 'auto', 
            objectFit: 'contain', 
            display: 'block' 
          }} 
        />
      </div>
      {/* 标签页：四个状态切换展示 */}
      <Card 
        title="🗂 待办事项"
        styles={{ header: { backgroundColor: '#f0f8ff', fontWeight: 'bold' } }}
      >
        <Tabs
          defaultActiveKey="pending"
          items={[
            {
              key: 'pending',
              label: `⏳ 待处理 (${pendingTodos.length})`,
              children: (
                <Spin spinning={loading}>
                  {pendingTodos.length === 0 ? (
                    <Empty 
                      description="暂无待处理的待办事项" 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <List
                      dataSource={pendingTodos}
                      renderItem={(todo) => {
                        const statusDisplay = getStatusDisplay(todo.status);
                        return (
                          <List.Item
                            style={{
                              border: '1px solid #f0f0f0',
                              borderRadius: '8px',
                              marginBottom: '12px',
                              padding: '16px',
                              backgroundColor: '#fafafa'
                            }}
                          >
                            <div style={{ width: '100%' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ width: '100%' }}>
                                  <Text 
                                    strong 
                                    style={{ 
                                      fontSize: '16px', 
                                      display: 'block', 
                                      whiteSpace: 'pre-wrap', 
                                      wordBreak: 'break-word' 
                                    }}
                                  >
                                    {todo.content}
                                  </Text>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <Tag color={statusDisplay.color}>
                                    {statusDisplay.emoji} {statusDisplay.text}
                                  </Tag>
                                  <Text type="secondary">
                                    <CalendarOutlined /> 创建时间: {moment(todo.createdAt).format('YYYY-MM-DD HH:mm')}
                                  </Text>
                                  {todo.dueDate && (
                                    <Text type={moment(todo.dueDate).isBefore(moment()) ? 'danger' : 'secondary'}>
                                      <ClockCircleOutlined /> 截止时间: {moment(todo.dueDate).format('YYYY-MM-DD')}
                                    </Text>
                                  )}
                                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                    <Button 
                                      type="primary" 
                                      icon={<CheckOutlined />}
                                      size="small"
                                      onClick={() => openActionModal(todo, '已完成')}
                                    >
                                      已完成
                                    </Button>
                                    <Button 
                                      danger 
                                      icon={<CloseOutlined />}
                                      size="small"
                                      onClick={() => openActionModal(todo, '已放弃')}
                                    >
                                      放弃
                                    </Button>
                                    <Button 
                                      type="default" 
                                      icon={<SwapOutlined />}
                                      size="small"
                                      onClick={() => openActionModal(todo, '已转交')}
                                    >
                                      转交
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  )}
                </Spin>
              )
            },
            {
              key: 'completed',
              label: `✅ 已完成 (${completedTodos.length})`,
              children: (
                <div>
                  {completedTodos.length === 0 ? (
                    <Empty 
                      description="暂无已完成的待办事项" 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <List
                      dataSource={completedTodos}
                      renderItem={(todo) => renderProcessedTodoItem(todo)}
                    />
                  )}
                </div>
              )
            },
            {
              key: 'abandoned',
              label: `❌ 已放弃 (${abandonedTodos.length})`,
              children: (
                <div>
                  {abandonedTodos.length === 0 ? (
                    <Empty 
                      description="暂无已放弃的待办事项" 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <List
                      dataSource={abandonedTodos}
                      renderItem={(todo) => renderProcessedTodoItem(todo)}
                    />
                  )}
                </div>
              )
            },
            {
              key: 'transferred',
              label: `🔄 已转交 (${transferredTodos.length})`,
              children: (
                <div>
                  {transferredTodos.length === 0 ? (
                    <Empty 
                      description="暂无已转交的待办事项" 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <List
                      dataSource={transferredTodos}
                      renderItem={(todo) => renderProcessedTodoItem(todo)}
                    />
                  )}
                </div>
              )
            }
          ]}
        />
      </Card>
      
      {/* 操作确认弹窗 */}
      <Modal
        title={`${getActionText(actionType)}待办事项`}
        open={actionModalVisible}
        onCancel={() => {
          setActionModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        {selectedTodo && (
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
              <Text strong>待办内容：</Text>
              <div style={{ marginTop: '4px' }}>{selectedTodo.content}</div>
            </div>
            
            <Form
              form={form}
              onFinish={handleTodoAction}
              layout="vertical"
            >
              <Form.Item
                name="summary"
                label={`请填写${getActionText(actionType)}简述`}
                rules={[
                  { required: true, message: `请填写${getActionText(actionType)}简述` }
                ]}
              >
                <TextArea 
                  rows={4} 
                  placeholder={`请详细说明${getActionText(actionType)}的原因或情况...`}
                  maxLength={500}
                  showCount
                />
              </Form.Item>
              
              <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                <Space>
                  <Button onClick={() => {
                    setActionModalVisible(false);
                    form.resetFields();
                  }}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit">
                    确认{getActionText(actionType)}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TodoList;