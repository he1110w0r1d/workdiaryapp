import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Tabs,
  Card, 
  Typography, 
  Tag, 
  Spin,
  Button,
  Modal,
  Empty,
  message,
  Space,
  Popconfirm
} from 'antd';
import { FileTextOutlined, CalendarOutlined, BarChartOutlined, TrophyOutlined, ReloadOutlined, DeleteOutlined, PlusOutlined, LinkOutlined } from '@ant-design/icons';
import api from '../utils/api';  // 修改这里
import moment from 'moment';

const { Title } = Typography;

const SummaryList = () => {
  const [dailySummaries, setDailySummaries] = useState([]);
  const [monthlySummaries, setMonthlySummaries] = useState([]);
  const [yearlySummaries, setYearlySummaries] = useState([]);
  const [loading, setLoading] = useState({ daily: false, monthly: false, yearly: false });
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [generateTodayLoading, setGenerateTodayLoading] = useState(false);
  const [generateMonthlyLoading, setGenerateMonthlyLoading] = useState(false);
  const [generateCurrentMonthlyLoading, setGenerateCurrentMonthlyLoading] = useState(false);
  const [generateYearlyLoading, setGenerateYearlyLoading] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('daily');
  const [pagination, setPagination] = useState({
    daily: { current: 1, pageSize: 10, total: 0 },
    monthly: { current: 1, pageSize: 10, total: 0 },
    yearly: { current: 1, pageSize: 10, total: 0 }
  });

  useEffect(() => {
    fetchSummaries('daily');
    fetchSummaries('monthly');
    fetchSummaries('yearly');
  }, []);

  const fetchSummaries = async (type) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      const params = {
        page: pagination[type].current,
        limit: pagination[type].pageSize,
        type: type
      };

      const response = await api.get('/summaries', { params });
      
      const summaries = response.data.summaries;
      const total = response.data.total;
      
      if (type === 'daily') {
        setDailySummaries(summaries);
      } else if (type === 'monthly') {
        setMonthlySummaries(summaries);
      } else if (type === 'yearly') {
        setYearlySummaries(summaries);
      }
      
      setPagination(prev => ({
        ...prev,
        [type]: { ...prev[type], total }
      }));
    } catch (error) {
      console.error(`获取${getTypeText(type)}失败:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleTableChange = (newPagination, type) => {
    setPagination(prev => ({
      ...prev,
      [type]: newPagination
    }));
    fetchSummaries(type);
  };

  // 重新生成昨日总结
  const handleRegenerateDailySummary = async () => {
    setRegenerateLoading(true);
    try {
      const response = await api.post('/summaries/regenerate/daily');
      message.success(response.data.message);
      // 重新获取每日总结列表
      fetchSummaries('daily');
    } catch (error) {
      console.error('重新生成昨日总结失败:', error);
      message.error('重新生成失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setRegenerateLoading(false);
    }
  };

  // 生成今日总结
  const handleGenerateTodaySummary = async () => {
    setGenerateTodayLoading(true);
    try {
      const response = await api.post('/summaries/generate/today');
      message.success(response.data.message);
      // 重新获取每日总结列表
      fetchSummaries('daily');
    } catch (error) {
      console.error('生成今日总结失败:', error);
      message.error('生成失败: ' + (error.response?.data?.message || error.message));
    } finally {
       setGenerateTodayLoading(false);
     }
   };

  // 生成月度总结
  const handleGenerateMonthlySummary = async () => {
    setGenerateMonthlyLoading(true);
    try {
      const response = await api.post('/summaries/generate/monthly');
      message.success(response.data.message);
      // 重新获取月度总结列表
      fetchSummaries('monthly');
    } catch (error) {
      console.error('生成月度总结失败:', error);
      message.error('生成失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setGenerateMonthlyLoading(false);
    }
  };

  // 生成当月总结
  const handleGenerateCurrentMonthlySummary = async () => {
    setGenerateCurrentMonthlyLoading(true);
    try {
      const response = await api.post('/summaries/generate/current-monthly');
      message.success(response.data.message);
      // 重新获取月度总结列表
      fetchSummaries('monthly');
    } catch (error) {
      console.error('生成当月总结失败:', error);
      message.error('生成失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setGenerateCurrentMonthlyLoading(false);
    }
  };

  // 生成年度总结
  const handleGenerateYearlySummary = async () => {
    setGenerateYearlyLoading(true);
    try {
      const response = await api.post('/summaries/generate/yearly');
      message.success(response.data.message);
      // 重新获取年度总结列表
      fetchSummaries('yearly');
    } catch (error) {
      console.error('生成年度总结失败:', error);
      message.error('生成失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setGenerateYearlyLoading(false);
    }
  };

  // 删除总结
  const handleDeleteSummary = async (summaryId, type) => {
    console.log('删除总结被调用:', summaryId, type);
    console.log('API URL:', `/summaries/${summaryId}`);
    try {
      const response = await api.delete(`/summaries/${summaryId}`);
      console.log('删除响应:', response);
      message.success('总结删除成功');
      // 重新获取对应类型的总结列表
      fetchSummaries(type);
    } catch (error) {
      console.error('删除总结失败 - 完整错误:', error);
      console.error('错误响应:', error.response);
      console.error('错误状态:', error.response?.status);
      console.error('错误数据:', error.response?.data);
      message.error('删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'daily': return '每日总结';
      case 'monthly': return '月度总结';
      case 'yearly': return '年度总结';
      default: return '未知';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'daily': return 'blue';
      case 'monthly': return 'green';
      case 'yearly': return 'purple';
      default: return 'default';
    }
  };

  const getColumns = (type) => [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (summaryType) => (
        <Tag color={getTypeColor(summaryType)}>{getTypeText(summaryType)}</Tag>
      )
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (text) => moment(text).format('YYYY-MM-DD'),
      sorter: (a, b) => new Date(a.date) - new Date(b.date)
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<FileTextOutlined />} 
            size="small"
            onClick={() => setSelectedSummary(record)}
          >
            查看详情
          </Button>
          {(type === 'monthly' || type === 'yearly') && record.htmlFilePath && (
            <Button 
              icon={<LinkOutlined />} 
              size="small"
              type="primary"
              onClick={() => window.open(`http://localhost:5000${record.htmlFilePath}`, '_blank')}
            >
              查看网页
            </Button>
          )}
          <Popconfirm
            title="确认删除"
            description="确定要删除这个总结吗？此操作不可恢复。"
            onConfirm={() => handleDeleteSummary(record._id, type)}
            okText="确定"
            cancelText="取消"
            placement="topRight"
          >
            <Button 
              icon={<DeleteOutlined />} 
              size="small"
              danger
              type="text"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const renderSummaryTable = (summaries, type) => {
    const currentLoading = loading[type];
    const currentPagination = pagination[type];
    
    return (
      <Table
        columns={getColumns(type)}
        dataSource={summaries}
        loading={currentLoading}
        pagination={{
          ...currentPagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
        onChange={(newPagination) => handleTableChange(newPagination, type)}
        rowKey="_id"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={`暂无${getTypeText(type)}`}
            />
          )
        }}
      />
    );
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>工作总结</Title>
      
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        type="card"
        size="large"
        items={[
          {
            key: 'daily',
            label: (
              <span>
                <CalendarOutlined />
                每日总结
              </span>
            ),
            children: (
              <Card 
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>每日工作总结</span>
                    <Space>
                      <Button 
                        type="default" 
                        icon={<ReloadOutlined />}
                        loading={regenerateLoading}
                        onClick={handleRegenerateDailySummary}
                        size="small"
                        style={{ backgroundColor: '#f0f0f0', borderColor: '#d9d9d9' }}
                      >
                        重新生成昨日总结
                      </Button>
                      <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        loading={generateTodayLoading}
                        onClick={handleGenerateTodaySummary}
                        size="small"
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      >
                        立即生成今日工作总结
                      </Button>
                    </Space>
                  </div>
                }
              >
                {renderSummaryTable(dailySummaries, 'daily')}
              </Card>
            )
          },
          {
            key: 'monthly',
            label: (
              <span>
                <BarChartOutlined />
                月底总结
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>月度工作总结</span>
                    <Space>
                      <Button 
                        type="default" 
                        icon={<PlusOutlined />}
                        loading={generateMonthlyLoading}
                        onClick={handleGenerateMonthlySummary}
                        size="small"
                        style={{ backgroundColor: '#f0f0f0', borderColor: '#d9d9d9' }}
                      >
                        生成上月总结
                      </Button>
                      <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        loading={generateCurrentMonthlyLoading}
                        onClick={handleGenerateCurrentMonthlySummary}
                        size="small"
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      >
                        生成当月总结
                      </Button>
                    </Space>
                  </div>
                }
              >
                {renderSummaryTable(monthlySummaries, 'monthly')}
              </Card>
            )
          },
          {
            key: 'yearly',
            label: (
              <span>
                <TrophyOutlined />
                年底总结
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>年度工作总结</span>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />}
                      loading={generateYearlyLoading}
                      onClick={handleGenerateYearlySummary}
                      size="small"
                      style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                    >
                      立即生成年度总结
                    </Button>
                  </div>
                }
              >
                {renderSummaryTable(yearlySummaries, 'yearly')}
              </Card>
            )
          }
        ]}
      />

      <Modal
        title={`${selectedSummary ? getTypeText(selectedSummary.type) : ''} - ${selectedSummary ? moment(selectedSummary.date).format('YYYY-MM-DD') : ''}`}
        open={!!selectedSummary}
        onCancel={() => setSelectedSummary(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedSummary(null)}>
            关闭
          </Button>
        ]}
        width={800}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
      >
        {selectedSummary && (
          <div 
            dangerouslySetInnerHTML={{ 
              __html: selectedSummary.content
                .replace(/(?:\r\n|\r|\n)/g, '<br>')
                .replace(/^# (.*?)<br>/gm, '<h2>$1</h2>')
                .replace(/^## (.*?)<br>/gm, '<h3>$1</h3>')
                .replace(/^\d+\. (.*?)<br>/gm, '<li>$1</li>')
            }} 
          />
        )}
      </Modal>
    </div>
  );
};

export default SummaryList;