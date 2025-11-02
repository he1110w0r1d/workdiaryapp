import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Typography, Tag, Tooltip, Popconfirm } from 'antd';
import { UndoOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import api from '../utils/api';
import moment from 'moment';

const { Title, Text } = Typography;

const RecycleBin = () => {
  const [deletedDiaries, setDeletedDiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 获取已删除的日记列表
  const fetchDeletedDiaries = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await api.get('/diaries/recycle/list', {
        params: { page, limit: pageSize }
      });
      
      setDeletedDiaries(response.data.diaries);
      setPagination({
        current: response.data.page,
        pageSize: pageSize,
        total: response.data.total
      });
    } catch (error) {
      message.error('获取回收站数据失败');
      console.error('Error fetching deleted diaries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedDiaries();
  }, []);

  // 恢复日记
  const handleRestore = async (diaryId) => {
    try {
      await api.put(`/diaries/${diaryId}/restore`);
      
      message.success('日记恢复成功');
      fetchDeletedDiaries(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('恢复日记失败');
      console.error('Error restoring diary:', error);
    }
  };

  // 永久删除日记
  const handlePermanentDelete = async (diaryId) => {
    try {
      await api.delete(`/diaries/${diaryId}/permanent`);
      
      message.success('日记已永久删除');
      fetchDeletedDiaries(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('永久删除失败');
      console.error('Error permanently deleting diary:', error);
    }
  };

  // 计算剩余天数
  const calculateRemainingDays = (deletedAt) => {
    const deletedDate = moment(deletedAt);
    const expiryDate = deletedDate.add(30, 'days');
    const now = moment();
    const remainingDays = expiryDate.diff(now, 'days');
    return Math.max(0, remainingDays);
  };

  // 获取剩余天数的颜色
  const getRemainingDaysColor = (days) => {
    if (days <= 3) return 'red';
    if (days <= 7) return 'orange';
    return 'green';
  };

  const columns = [
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      width: 250,
      ellipsis: {
        showTitle: false,
      },
      render: (content) => (
        <Tooltip placement="topLeft" title={content}>
          <Text style={{ maxWidth: 250 }}>{content}</Text>
        </Tooltip>
      ),
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      width: 100,
    },
    {
      title: '工作优先级',
      dataIndex: 'workPriority',
      key: 'workPriority',
      width: 130,
      render: (priority) => {
        const color = priority === '高' ? 'red' : priority === '中' ? 'orange' : 'green';
        return <Tag color={color}>{priority}</Tag>;
      },
    },
    {
      title: '是否待办',
      dataIndex: 'isTodo',
      key: 'isTodo',
      width: 110,
      render: (isTodo) => (
        <Tag color={isTodo ? 'blue' : 'default'}>
          {isTodo ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '删除时间',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      width: 150,
      render: (deletedAt) => moment(deletedAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '剩余天数',
      key: 'remainingDays',
      width: 100,
      render: (_, record) => {
        const days = calculateRemainingDays(record.deletedAt);
        return (
          <Tag color={getRemainingDaysColor(days)}>
            {days === 0 ? '即将删除' : `${days}天`}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="恢复日记">
            <Button
              type="primary"
              icon={<UndoOutlined />}
              size="small"
              onClick={() => handleRestore(record._id)}
            >
              恢复
            </Button>
          </Tooltip>
          <Tooltip title="永久删除">
            <Popconfirm
              title="确认永久删除"
              description="此操作不可恢复，确定要永久删除这条日记吗？"
              onConfirm={() => handlePermanentDelete(record._id)}
              okText="确定"
              cancelText="取消"
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
              >
                永久删除
              </Button>
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleTableChange = (paginationConfig) => {
    fetchDeletedDiaries(paginationConfig.current, paginationConfig.pageSize);
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '8px' }}>
          <img 
            src={process.env.PUBLIC_URL + '/pic/logo6.png'} 
            alt="日记回收站"
            style={{ height: '80px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </div>
        <Text type="secondary">
          已删除的日记将在此保留30天，30天后自动永久删除。在此期间您可以恢复或手动永久删除。
        </Text>
      </div>
      
      <Table
        columns={columns}
        dataSource={deletedDiaries}
        rowKey="_id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
      />
    </div>
  );
};

export default RecycleBin;