import React, { useState, useEffect } from 'react';
import { 
  List, 
  Card, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Input, 
  DatePicker, 
  Select, 
  message,
  Pagination,
  Typography,
  Tooltip,
  Form,
  Table
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import moment from 'moment';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const DiaryList = () => {
  const [diaries, setDiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchDeleteModalVisible, setBatchDeleteModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingDiary, setViewingDiary] = useState(null);
  const [todoStatusModalVisible, setTodoStatusModalVisible] = useState(false);
  const [todoStatusForm] = Form.useForm();
  const [currentTodoAction, setCurrentTodoAction] = useState(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // 检查URL参数中的日期筛选
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const date = moment(dateParam);
      if (date.isValid()) {
        setDateRange([date, date]);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetchDiaries();
  }, [pagination.current, searchText, dateRange]);

  // 监听待办状态更新事件
  useEffect(() => {
    const handleTodoStatusUpdate = () => {
      fetchDiaries(); // 重新获取日记数据以更新待办状态显示
    };

    window.addEventListener('todoStatusUpdated', handleTodoStatusUpdate);
    
    return () => {
      window.removeEventListener('todoStatusUpdated', handleTodoStatusUpdate);
    };
  }, []);

  const fetchDiaries = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize
      };

      if (searchText) {
        params.search = searchText;
      }

      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await api.get('/diaries', { params });  // 修改这里
      
      setDiaries(response.data.diaries);
      setPagination({
        ...pagination,
        total: response.data.total
      });
    } catch (error) {
      message.error('获取工作日记失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (pagination) => {
    setPagination(pagination);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/diaries/${selectedDiary._id}`);  // 修改这里
      message.success('删除成功');
      setDeleteModalVisible(false);
      fetchDiaries();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    try {
      await Promise.all(
        selectedRowKeys.map(id => api.delete(`/diaries/${id}`))
      );
      message.success(`成功删除 ${selectedRowKeys.length} 条日记`);
      setBatchDeleteModalVisible(false);
      setSelectedRowKeys([]);
      fetchDiaries();
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    onSelectAll: (selected, selectedRows, changeRows) => {
      if (selected) {
        setSelectedRowKeys(diaries.map(diary => diary._id));
      } else {
        setSelectedRowKeys([]);
      }
    },
  };

  const columns = [
    {
      title: '工作内容',
      dataIndex: 'content',
      key: 'content',
      render: (text, record) => (
        <div 
          style={{ 
            maxWidth: '300px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            color: '#1890ff',
            transition: 'all 0.3s'
          }}
          onClick={() => {
            setViewingDiary(record);
            setViewModalVisible(true);
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f0f8ff';
            e.target.style.padding = '4px 8px';
            e.target.style.borderRadius = '4px';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.padding = '0';
          }}
          title="点击查看完整内容"
        >
          {text}
        </div>
      )
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: '时间',
      key: 'time',
      render: (_, record) => (
        <div>
          <div>{moment(record.startTime).format('MM-DD HH:mm')}</div>
          <div>{moment(record.endTime).format('MM-DD HH:mm')}</div>
        </div>
      )
    },
    {
      title: '标签',
      key: 'tags',
      dataIndex: 'tags',
      render: (_, { tags }) => (
        <>
          {tags.map((tag) => {
            let color = tag.length > 5 ? 'geekblue' : 'green';
            if (tag === '紧急') {
              color = 'volcano';
            }
            return (
              <Tag color={color} key={tag}>
                {tag.toUpperCase()}
              </Tag>
            );
          })}
        </>
      ),
    },
    {
      title: '优先级',
      key: 'workPriority',
      dataIndex: 'workPriority',
      render: (priority) => {
        // 处理优先级字段缺失的情况，默认为'中'
        const actualPriority = priority || '中';
        let color = 'default';
        let emoji = '🟡';
        if (actualPriority === '高') {
          color = 'red';
          emoji = '🔴';
        } else if (actualPriority === '低') {
          color = 'green';
          emoji = '🟢';
        } else {
          color = 'orange';
          emoji = '🟡';
        }
        return (
          <Tag color={color}>
            {emoji} {actualPriority}
          </Tag>
        );
      },
    },
    {
      title: '待办状态',
      key: 'todoStatus',
      render: (_, record) => {
        if (!record.isTodo) {
          return <Tag color="default">📝 普通日记</Tag>;
        }
        
        const status = record.todoStatus || '待办';
        let color, emoji, text;
        
        switch (status) {
          case '待办':
            color = 'processing';
            emoji = '⏳';
            text = '待处理';
            break;
          case '已完成':
            color = 'success';
            emoji = '✅';
            text = '已完成';
            break;
          case '已放弃':
            color = 'default';
            emoji = '❌';
            text = '已放弃';
            break;
          case '已转交':
            color = 'warning';
            emoji = '🔄';
            text = '已转交';
            break;
          default:
            color = 'processing';
            emoji = '⏳';
            text = '待处理';
        }
        
        return (
          <Tag color={color}>
            {emoji} {text}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Link to={`/app/diaries/${record._id}/edit`}>
            <Button icon={<EditOutlined />} size="small">
              编辑
            </Button>
          </Link>
          <Button 
            icon={<DeleteOutlined />} 
            size="small" 
            danger
            onClick={() => {
              setSelectedDiary(record);
              setDeleteModalVisible(true);
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 16 
      }}>
        <Title level={2}>工作日记</Title>
        <Link to="/app/diaries/new">
          <Button type="primary" icon={<PlusOutlined />}>
            新增日记
          </Button>
        </Link>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <Input
          placeholder="搜索工作内容"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 200 }}
        />
        <RangePicker 
          onChange={setDateRange}
          placeholder={['开始日期', '结束日期']}
        />
        <Button onClick={() => {
          setSearchText('');
          setDateRange(null);
        }}>
          清除筛选
        </Button>
        {selectedRowKeys.length > 0 && (
          <Button 
            danger
            icon={<DeleteOutlined />}
            onClick={() => setBatchDeleteModalVisible(true)}
          >
            批量删除 ({selectedRowKeys.length})
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={diaries}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        rowKey="_id"
        rowSelection={rowSelection}
      />

      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={handleDelete}
        onCancel={() => setDeleteModalVisible(false)}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除这条工作日记吗？</p>
      </Modal>

      <Modal
        title="批量删除确认"
        open={batchDeleteModalVisible}
        onOk={handleBatchDelete}
        onCancel={() => setBatchDeleteModalVisible(false)}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除选中的 {selectedRowKeys.length} 条工作日记吗？此操作不可撤销。</p>
      </Modal>

      <Modal
        title="工作日记详情"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            关闭
          </Button>,
          viewingDiary && (
            <Link key="edit" to={`/app/diaries/${viewingDiary._id}/edit`}>
              <Button type="primary" icon={<EditOutlined />}>
                编辑
              </Button>
            </Link>
          )
        ]}
        width={800}
      >
        {viewingDiary && (
          <div style={{ lineHeight: '1.8' }}>
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#1890ff', fontSize: '16px' }}>📝 工作内容：</strong>
              <div style={{ 
                marginTop: '8px', 
                padding: '12px', 
                backgroundColor: '#f9f9f9', 
                borderRadius: '6px',
                border: '1px solid #e8e8e8',
                whiteSpace: 'pre-wrap',
                fontSize: '14px',
                lineHeight: '1.6'
              }}>
                {viewingDiary.content}
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#52c41a', fontSize: '14px' }}>📍 工作地点：</strong>
              <span style={{ marginLeft: '8px', fontSize: '14px' }}>{viewingDiary.location || '未填写'}</span>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#fa8c16', fontSize: '14px' }}>⏰ 工作时间：</strong>
              <div style={{ marginLeft: '8px', fontSize: '14px' }}>
                <div>开始：{moment(viewingDiary.startTime).format('YYYY-MM-DD HH:mm')}</div>
                <div>结束：{moment(viewingDiary.endTime).format('YYYY-MM-DD HH:mm')}</div>
                <div style={{ color: '#666', fontSize: '12px' }}>
                  时长：{moment.duration(moment(viewingDiary.endTime).diff(moment(viewingDiary.startTime))).humanize()}
                </div>
              </div>
            </div>
            
            {viewingDiary.tags && viewingDiary.tags.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ color: '#722ed1', fontSize: '14px' }}>🏷️ 标签：</strong>
                <div style={{ marginTop: '8px' }}>
                  {viewingDiary.tags.map((tag) => {
                    let color = tag.length > 5 ? 'geekblue' : 'green';
                    if (tag === '紧急') {
                      color = 'volcano';
                    }
                    return (
                      <Tag color={color} key={tag} style={{ marginBottom: '4px' }}>
                        {tag.toUpperCase()}
                      </Tag>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#eb2f96', fontSize: '14px' }}>⚡ 优先级：</strong>
              <div style={{ marginTop: '8px' }}>
                {(() => {
                  const priority = viewingDiary.workPriority || '中';
                  let color = 'default';
                  let emoji = '🟡';
                  if (priority === '高') {
                    color = 'red';
                    emoji = '🔴';
                  } else if (priority === '低') {
                    color = 'green';
                    emoji = '🟢';
                  } else {
                    color = 'orange';
                    emoji = '🟡';
                  }
                  return (
                    <Tag color={color}>
                      {emoji} {priority}
                    </Tag>
                  );
                })()}
              </div>
            </div>
            
            {/* 待办状态显示与管理 */}
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#13c2c2', fontSize: '14px' }}>📋 待办状态：</strong>
              <div style={{ marginTop: '8px' }}>
                {(() => {
                  // 判断是否为待办日记 - 使用isTodo字段
                  const isTodoItem = viewingDiary.isTodo === true;
                  
                  if (!isTodoItem) {
                    return (
                      <Tag color="default">
                        📝 无待办状态
                      </Tag>
                    );
                  }
                  
                  const status = viewingDiary.todoStatus || '待办';
                  let color, emoji, text;
                  
                  switch (status) {
                    case '待办':
                      color = 'processing';
                      emoji = '⏳';
                      text = '待处理';
                      break;
                    case '已完成':
                      color = 'success';
                      emoji = '✅';
                      text = '已完成';
                      break;
                    case '已放弃':
                      color = 'error';
                      emoji = '❌';
                      text = '已放弃';
                      break;
                    case '已转交':
                      color = 'warning';
                      emoji = '🔄';
                      text = '已转交';
                      break;
                    default:
                      color = 'processing';
                      emoji = '⏳';
                      text = '待处理';
                  }
                  
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Tag color={color}>
                        {emoji} {text}
                      </Tag>
                      {/* 待办管理按钮 */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {status !== '已完成' && (
                          <Button 
                            size="small" 
                            type="primary" 
                            onClick={() => {
                              setCurrentTodoAction({ status: '已完成', label: '完成' });
                              setTodoStatusModalVisible(true);
                            }}
                          >
                            ✅ 完成
                          </Button>
                        )}
                        {status !== '已放弃' && (
                          <Button 
                            size="small" 
                            danger
                            onClick={() => {
                              setCurrentTodoAction({ status: '已放弃', label: '放弃' });
                              setTodoStatusModalVisible(true);
                            }}
                          >
                            ❌ 放弃
                          </Button>
                        )}
                        {status !== '已转交' && (
                          <Button 
                            size="small" 
                            onClick={() => {
                              setCurrentTodoAction({ status: '已转交', label: '转交' });
                              setTodoStatusModalVisible(true);
                            }}
                          >
                            🔄 转交
                          </Button>
                        )}
                        {status !== '待办' && (
                          <Button 
                            size="small" 
                            onClick={() => {
                              setCurrentTodoAction({ status: '待办', label: '重置' });
                              setTodoStatusModalVisible(true);
                            }}
                          >
                            ⏳ 重置
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div style={{ 
              marginTop: '20px', 
              paddingTop: '16px', 
              borderTop: '1px solid #e8e8e8',
              color: '#999',
              fontSize: '12px'
            }}>
              创建时间：{moment(viewingDiary.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
        )}
      </Modal>

      {/* 待办状态更新Modal */}
      <Modal
        title={`${currentTodoAction?.label}待办`}
        open={todoStatusModalVisible}
        onOk={async () => {
          try {
            const values = await todoStatusForm.validateFields();
            await api.put(`/diaries/${viewingDiary._id}/todo-status`, {
              todoStatus: currentTodoAction.status,
              statusDescription: values.description
            });
            message.success(`待办状态已更新为${currentTodoAction.status}`);
            setViewingDiary({...viewingDiary, todoStatus: currentTodoAction.status});
            window.dispatchEvent(new CustomEvent('todoStatusUpdated'));
            setTodoStatusModalVisible(false);
            todoStatusForm.resetFields();
          } catch (error) {
            message.error('更新状态失败');
          }
        }}
        onCancel={() => {
          setTodoStatusModalVisible(false);
          todoStatusForm.resetFields();
        }}
        okText="确认"
        cancelText="取消"
      >
        <Form
          form={todoStatusForm}
          layout="vertical"
        >
          <Form.Item
            name="description"
            label="简述"
            rules={[{ required: true, message: '请填写简述' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder={`请简述${currentTodoAction?.label}的原因或详情...`}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DiaryList;