import React, { useState, useEffect, useRef } from 'react';
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
  Table,
  Upload,
  Checkbox,
  Segmented,
  Collapse,
  Drawer
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import moment from 'moment';
import dayjs from 'dayjs';
import PageHeading from './PageHeading';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const DiaryList = () => {
  const [view, setView] = useState('列表');
  const fetchId = useRef(0);
  const [diaries, setDiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedTodoStatus, setSelectedTodoStatus] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
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
  const [importModalVisible, setImportModalVisible] = useState(false);

  // 响应式：在小屏上使用卡片式单行布局
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [queryInitialized, setQueryInitialized] = useState(false);
  const [hasUrlDate, setHasUrlDate] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // 检查URL参数中的日期筛选
    // 兼容不同的查询参数键：优先使用 `date`，回退到 `dates`
    setSearchText(searchParams.get('search') || '');
    setPagination(p => ({ ...p, current: 1 }));
    const dateParam = searchParams.get('date') || searchParams.get('dates');
    if (dateParam) {
      const date = dayjs(dateParam);
      if (date.isValid()) {
        setDateRange([date, date]);
        setHasUrlDate(true);
      }
    } else {
      // 无URL日期参数，直接允许初始化后的首次拉取
      setDateRange(null);
      setQueryInitialized(true);
      setHasUrlDate(false);
    }
  }, [searchParams]);

  // 当存在URL日期参数时，等待dateRange设置完成后再允许首拉取
  useEffect(() => {
    if (hasUrlDate && dateRange) {
      setQueryInitialized(true);
    }
  }, [hasUrlDate, dateRange]);

  useEffect(() => {
    if (!queryInitialized) return;
    fetchDiaries();
  }, [queryInitialized, pagination.current, pagination.pageSize, searchText, dateRange, selectedTags, selectedPriority, selectedTodoStatus]);

  // 获取可用标签
  const fetchAvailableTags = async () => {
    try {
      console.log('开始获取可用标签...');
      const response = await api.get('/diaries/tags');
      console.log('获取标签响应:', response.data);
      setAvailableTags(response.data.tags || []);
      console.log('设置可用标签:', response.data.tags || []);
    } catch (error) {
      console.error('获取标签失败:', error);
      console.error('错误详情:', error.response?.data);
    }
  };

  useEffect(() => {
    fetchAvailableTags();
  }, []);

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
    const request = ++fetchId.current;
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

      if (selectedTags.length > 0) {
        params.tags = selectedTags.join(',');
      }

      if (selectedPriority) {
        params.priority = selectedPriority;
      }

      if (selectedTodoStatus) {
        params.todoStatus = selectedTodoStatus;
      }

      const response = await api.get('/diaries', { params });  // 修改这里
      
      if (request !== fetchId.current) return;
      setDiaries(response.data.diaries);
      setPagination({
        ...pagination,
        total: response.data.total
      });
    } catch (error) {
      if (request === fetchId.current) message.error('获取工作日记失败');
    } finally {
      if (request === fetchId.current) setLoading(false);
    }
  };

  const handleTableChange = (pagination) => {
    setPagination(pagination);
  };

  // 导出功能
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = {};
      
      if (searchText) params.search = searchText;
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (selectedTags.length > 0) params.tags = selectedTags.join(',');
      if (selectedPriority) params.priority = selectedPriority;
      if (selectedTodoStatus) params.todoStatus = selectedTodoStatus;
      
      const response = await api.get('/diaries/export', { 
        params
      });
      
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `工作日记导出_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    } finally {
      setExportLoading(false);
    }
  };

  // 导入功能
  const handleImport = async (file) => {
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/diaries/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      message.success(`导入成功，共导入 ${response.data.importedCount} 条日记`);
      setImportModalVisible(false);
      fetchDiaries(); // 刷新列表
    } catch (error) {
      message.error(error.response?.data?.message || '导入失败');
    } finally {
      setImportLoading(false);
    }
    
    return false; // 阻止默认上传行为
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

  // 渲染移动端卡片式单行项目
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
            color: '#315d4e',
            transition: 'all 0.3s'
          }}
          onClick={async () => {
            try {
              // 重新获取包含relatedTodo信息的完整日记数据
              const response = await api.get(`/diaries/${record._id}`);
              setViewingDiary(response.data);
              setViewModalVisible(true);
            } catch (error) {
              message.error('获取日记详情失败');
            }
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f2f5ed';
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
        let emoji = '';
        if (actualPriority === '高') {
          color = 'red';
          emoji = '';
        } else if (actualPriority === '低') {
          color = 'green';
          emoji = '';
        } else {
          color = 'orange';
          emoji = '';
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
          return <Tag color="default"> 普通日记</Tag>;
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
            emoji = '';
            text = '已完成';
            break;
          case '已放弃':
            color = 'default';
            emoji = '';
            text = '已放弃';
            break;
          case '已转交':
            color = 'warning';
            emoji = '';
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
      <PageHeading eyebrow="WORK NOTES" title="工作日记" description="让每一次进展，都有迹可循。" actions={<Space wrap><Link to="/app/recycle"><Button type="text">回收站</Button></Link><Link to="/app/diaries/new"><Button type="primary">记一笔</Button></Link></Space>} />
      <div className="diary-list-toolbar">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            placeholder="搜索工作内容"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            style={{ width: 200 }}
          />
          <RangePicker 
            value={dateRange}
            onChange={value => { setDateRange(value); setPagination(p => ({ ...p, current: 1 })); }}
            placeholder={['开始日期', '结束日期']}
          />
          {!isMobile && <Segmented aria-label="日记显示方式" options={['列表', '表格']} value={view} onChange={setView} />}
          <Button onClick={() => {
            setPagination(p => ({ ...p, current: 1 }));
            setSearchText('');
            setDateRange(null);
            setSelectedTags([]);
            setSelectedPriority('');
            setSelectedTodoStatus('');
          }}>
            清除筛选
          </Button>
        </div>
        <Collapse ghost items={[{ key: 'filters', label: '更多筛选：标签、优先级和待办状态', children: <Space wrap>          <Select
            mode="multiple"
            placeholder="选择标签"
            value={selectedTags}
            onChange={value => { setSelectedTags(value); setPagination(p => ({ ...p, current: 1 })); }}
            style={{ minWidth: 150 }}
            allowClear
          >
            {availableTags.map(tag => (
              <Select.Option key={tag} value={tag}>{tag}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="选择优先级"
            value={selectedPriority || undefined}
            onChange={value => { setSelectedPriority(value); setPagination(p => ({ ...p, current: 1 })); }}
            style={{ width: 140 }}
            allowClear
          >
            <Select.Option value="高"> 高</Select.Option>
            <Select.Option value="中"> 中</Select.Option>
            <Select.Option value="低"> 低</Select.Option>
          </Select>
          <Select
            placeholder="选择待办状态"
            value={selectedTodoStatus || undefined}
            onChange={value => { setSelectedTodoStatus(value); setPagination(p => ({ ...p, current: 1 })); }}
            style={{ width: 140 }}
            allowClear
          >
            <Select.Option value="待办">⏳ 待办</Select.Option>
            <Select.Option value="已完成"> 已完成</Select.Option>
            <Select.Option value="已放弃">已放弃</Select.Option><Select.Option value="已转交">已转交</Select.Option>
          </Select>
</Space> }]} />
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

      {isMobile || view === '列表' ? (
        <List
          loading={loading}
          dataSource={diaries}
          className="diary-reading-list"
          locale={{ emptyText: '没有符合条件的记录，可以调整筛选或记下第一笔。' }}
          renderItem={entry => <List.Item key={entry._id}><div className="diary-reading-row">
            <Checkbox aria-label="选择这条日记" checked={selectedRowKeys.includes(entry._id)} onChange={e => setSelectedRowKeys(keys => e.target.checked ? [...keys, entry._id] : keys.filter(key => key !== entry._id))} />
            <div className="diary-reading-body"><button onClick={async () => { try { const response = await api.get(`/diaries/${entry._id}`); setViewingDiary(response.data); setViewModalVisible(true); } catch (_) { message.error('获取日记详情失败'); } }}>{entry.content}</button>
              <div className="diary-reading-meta"><span>{moment(entry.startTime).format('YYYY-MM-DD HH:mm')}</span><span>{Math.round((new Date(entry.endTime) - new Date(entry.startTime)) / 60000)} 分钟</span>{entry.location && <span>{entry.location}</span>}{entry.tags?.map(tag => <Tag key={tag}>{tag}</Tag>)}{entry.isTodo && <Tag>{entry.todoStatus || '待办'}</Tag>}</div></div>
            <div className="diary-row-actions"><Link to={`/app/diaries/${entry._id}/edit`}><Button type="text" icon={<EditOutlined />} aria-label="编辑日记" /></Link><Button type="text" icon={<DeleteOutlined />} aria-label="移至回收站" onClick={() => { setSelectedDiary(entry); setDeleteModalVisible(true); }} /></div>
          </div></List.Item>}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize })
          }}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={diaries}
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          rowKey="_id"
          rowSelection={rowSelection}
        />
      )}

      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={handleDelete}
        onCancel={() => setDeleteModalVisible(false)}
        okText="移至回收站"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除这条工作日记吗？</p>
        <p style={{ color: '#666', fontSize: '12px' }}>删除后的日记将移至回收站，可在30天内恢复。</p>
      </Modal>

      <Modal
        title="批量删除确认"
        open={batchDeleteModalVisible}
        onOk={handleBatchDelete}
        onCancel={() => setBatchDeleteModalVisible(false)}
        okText="移至回收站"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除选中的 {selectedRowKeys.length} 条工作日记吗？</p>
        <p style={{ color: '#666', fontSize: '12px' }}>删除后的日记将移至回收站，可在30天内恢复。</p>
      </Modal>

      <Drawer
        title="工作日记详情"
        open={viewModalVisible}
        onClose={() => setViewModalVisible(false)}
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
        width={720}
      >
        {viewingDiary && (
          <div style={{ lineHeight: '1.8' }}>
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#315d4e', fontSize: '16px' }}> 工作内容：</strong>
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
              <strong style={{ color: '#52c41a', fontSize: '14px' }}> 工作地点：</strong>
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
                <strong style={{ color: '#722ed1', fontSize: '14px' }}> 标签：</strong>
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
              <strong style={{ color: '#eb2f96', fontSize: '14px' }}> 优先级：</strong>
              <div style={{ marginTop: '8px' }}>
                {(() => {
                  const priority = viewingDiary.workPriority || '中';
                  let color = 'default';
                  let emoji = '';
                  if (priority === '高') {
                    color = 'red';
                    emoji = '';
                  } else if (priority === '低') {
                    color = 'green';
                    emoji = '';
                  } else {
                    color = 'orange';
                    emoji = '';
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
              <strong style={{ color: '#13c2c2', fontSize: '14px' }}> 待办状态：</strong>
              <div style={{ marginTop: '8px' }}>
                {(() => {
                  // 判断是否为待办日记 - 使用isTodo字段
                  const isTodoItem = viewingDiary.isTodo === true;
                  
                  if (!isTodoItem) {
                    return (
                      <Tag color="default">
                         无待办状态
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
                      emoji = '';
                      text = '已完成';
                      break;
                    case '已放弃':
                      color = 'error';
                      emoji = '';
                      text = '已放弃';
                      break;
                    case '已转交':
                      color = 'warning';
                      emoji = '';
                      text = '已转交';
                      break;
                    default:
                      color = 'processing';
                      emoji = '⏳';
                      text = '待处理';
                  }
                  
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
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
                               完成
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
                               放弃
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
                               转交
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
                      
                      {/* 待办简述显示 */}
                      {viewingDiary.relatedTodo && viewingDiary.relatedTodo.statusHistory && viewingDiary.relatedTodo.statusHistory.length > 0 && (
                        <div style={{ 
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: '#f6ffed',
                          border: '1px solid #b7eb8f',
                          borderRadius: '6px'
                        }}>
                          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#389e0d', fontSize: '13px' }}>
                             状态变更记录：
                          </div>
                          {viewingDiary.relatedTodo.statusHistory
                            .slice(-3) // 只显示最近3条记录
                            .reverse() // 最新的在前
                            .map((history, index) => {
                              const historyStatus = history.status;
                              let statusColor, statusEmoji, statusText;
                              
                              switch (historyStatus) {
                                case '待办':
                                  statusColor = '#315d4e';
                                  statusEmoji = '⏳';
                                  statusText = '待处理';
                                  break;
                                case '已完成':
                                  statusColor = '#52c41a';
                                  statusEmoji = '';
                                  statusText = '已完成';
                                  break;
                                case '已放弃':
                                  statusColor = '#ff4d4f';
                                  statusEmoji = '';
                                  statusText = '已放弃';
                                  break;
                                case '已转交':
                                  statusColor = '#fa8c16';
                                  statusEmoji = '';
                                  statusText = '已转交';
                                  break;
                                default:
                                  statusColor = '#315d4e';
                                  statusEmoji = '⏳';
                                  statusText = '待处理';
                              }
                              
                              return (
                                <div key={index} style={{ 
                                  marginBottom: index < viewingDiary.relatedTodo.statusHistory.slice(-3).length - 1 ? '8px' : '0',
                                  padding: '8px',
                                  backgroundColor: '#fff',
                                  borderRadius: '4px',
                                  border: '1px solid #e8f5e8'
                                }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginBottom: '4px'
                                  }}>
                                    <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '12px' }}>
                                      {statusEmoji} {statusText}
                                    </span>
                                    <span style={{ color: '#999', fontSize: '11px' }}>
                                      {moment(history.changedAt).format('MM-DD HH:mm')}
                                    </span>
                                  </div>
                                  {history.reason && (
                                    <div style={{ 
                                      fontSize: '12px', 
                                      color: '#666',
                                      lineHeight: '1.4',
                                      fontStyle: 'italic'
                                    }}>
                                      "{history.reason}"
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          }
                        </div>
                      )}
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
      </Drawer>

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
            window.dispatchEvent(new CustomEvent('todosUpdated'));
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

      {/* 已移除导入模态框，避免与用户信息导出功能冲突 */}
    </div>
  );
};

export default DiaryList;