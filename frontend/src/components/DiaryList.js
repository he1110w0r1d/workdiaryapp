import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  message, 
  DatePicker, 
  Input,
  Typography 
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';  // 修改这里
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
      render: (text) => (
        <div style={{ 
          maxWidth: '300px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
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
          <Link to={`/diaries/${record._id}/edit`}>
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
        <Link to="/diaries/new">
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
    </div>
  );
};

export default DiaryList;