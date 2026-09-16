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
  Popconfirm,
  Input,
  List,
  DatePicker,
} from 'antd';
import { FileTextOutlined, CalendarOutlined, BarChartOutlined, TrophyOutlined, ReloadOutlined, DeleteOutlined, PlusOutlined, LinkOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import api from '../utils/api';  // 修改这里
import moment from 'moment';
import dayjs from 'dayjs';
import Logger from '../utils/logger';

const { TextArea } = Input;

const { Title } = Typography;

const SummaryList = () => {
  const [dailySummaries, setDailySummaries] = useState([]);
  const [weeklySummaries, setWeeklySummaries] = useState([]);
  const [monthlySummaries, setMonthlySummaries] = useState([]);
  const [yearlySummaries, setYearlySummaries] = useState([]);
  const [loading, setLoading] = useState({ daily: false, weekly: false, monthly: false, yearly: false });
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [generateTodayLoading, setGenerateTodayLoading] = useState(false);
  const [generateWeeklyLoading, setGenerateWeeklyLoading] = useState(false);
  const [generateMonthlyLoading, setGenerateMonthlyLoading] = useState(false);
  const [generateCurrentMonthlyLoading, setGenerateCurrentMonthlyLoading] = useState(false);
  const [generateYearlyLoading, setGenerateYearlyLoading] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('daily');
  const [promptModalVisible, setPromptModalVisible] = useState(false);
  const [currentPromptType, setCurrentPromptType] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [pagination, setPagination] = useState({
    daily: { current: 1, pageSize: 10, total: 0 },
    weekly: { current: 1, pageSize: 10, total: 0 },
    monthly: { current: 1, pageSize: 10, total: 0 },
    yearly: { current: 1, pageSize: 10, total: 0 }
  });
  const [unreadCounts, setUnreadCounts] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
    yearly: 0
  });
  const [generateYear, setGenerateYear] = useState(dayjs());
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 获取未读数量
  const fetchUnreadCounts = async () => {
    try {
      const response = await api.get('/summaries/unread/count');
      setUnreadCounts({
        daily: response.data.daily || 0,
        weekly: response.data.weekly || 0,
        monthly: response.data.monthly || 0,
        yearly: response.data.yearly || 0
      });
    } catch (error) {
      console.error('获取未读数量失败:', error);
    }
  };

  useEffect(() => {
    fetchSummaries('daily');
    fetchSummaries('weekly');
    fetchSummaries('monthly');
    fetchSummaries('yearly');
    fetchUnreadCounts();

    // 监听总结更新事件
    const handleSummariesUpdate = () => {
      fetchUnreadCounts();
    };

    window.addEventListener('summariesUpdated', handleSummariesUpdate);

    return () => {
      window.removeEventListener('summariesUpdated', handleSummariesUpdate);
    };
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
      } else if (type === 'weekly') {
        setWeeklySummaries(summaries);
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

  // 生成每周总结
  const handleGenerateWeeklySummary = async () => {
    setGenerateWeeklyLoading(true);
    try {
      const response = await api.post('/summaries/generate/weekly');
      message.success(response.data.message);
      // 重新获取每周总结列表
      fetchSummaries('weekly');
    } catch (error) {
      console.error('生成每周总结失败:', error);
      message.error('生成失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setGenerateWeeklyLoading(false);
    }
  };

  // 重新生成上周总结
  const [regenerateLastWeeklyLoading, setRegenerateLastWeeklyLoading] = useState(false);
  const handleRegenerateLastWeeklySummary = async () => {
    setRegenerateLastWeeklyLoading(true);
    try {
      const response = await api.post('/summaries/regenerate/weekly/last');
      message.success(response.data.message);
      // 重新获取每周总结列表
      fetchSummaries('weekly');
    } catch (error) {
      console.error('重新生成上周总结失败:', error);
      message.error('重新生成失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setRegenerateLastWeeklyLoading(false);
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
      const year = generateYear.year();
      const response = await api.post(`/summaries/generate/yearly?year=${year}`);
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
    Logger.user('删除总结:', { summaryId, type });
    try {
      const response = await api.delete(`/summaries/${summaryId}`);
      Logger.api('删除总结成功:', response.data);
      message.success('总结删除成功');
      // 重新获取对应类型的总结列表
      fetchSummaries(type);
    } catch (error) {
      Logger.error('删除总结失败:', error);
      message.error('删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'daily': return '每日总结';
      case 'weekly': return '每周总结';
      case 'monthly': return '月度总结';
      case 'yearly': return '年度总结';
      default: return '未知';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'daily': return 'blue';
      case 'weekly': return 'cyan';
      case 'monthly': return 'green';
      case 'yearly': return 'purple';
      default: return 'default';
    }
  };

  // 计算每周范围（用于无 meta 回退）
  const getWeeklyRangeLabel = (date) => {
    const startDate = moment(date);
    const endDate = moment(date).add(6, 'days');
    return `${startDate.format('YYYY/MM/DD')} - ${endDate.format('YYYY/MM/DD')}`;
  };

  // 弹窗标题中的日期/范围文案
  const getTitleDateText = (summary) => {
    if (!summary) return '';
    if (summary.type === 'weekly') {
      return summary.meta?.rangeLabel || getWeeklyRangeLabel(summary.date);
    }
    if (summary.type === 'monthly') {
      return moment(summary.date).format('YYYY年M月');
    }
    if (summary.type === 'yearly') {
      return moment(summary.date).format('YYYY年');
    }
    return moment(summary.date).format('YYYY-MM-DD');
  };

  // 查看提示词
  const handleViewPrompt = async (type) => {
    setCurrentPromptType(type);
    setPromptModalVisible(true);
    setPromptLoading(true);
    setIsEditingPrompt(false);
    
    try {
      const response = await api.get(`/summaries/prompt/${type}`);
      setPromptContent(response.data.content);
    } catch (error) {
      console.error('获取提示词失败:', error);
      message.error('获取提示词失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setPromptLoading(false);
    }
  };

  // 更新提示词
  const handleUpdatePrompt = async () => {
    setPromptLoading(true);
    try {
      const response = await api.put(`/summaries/prompt/${currentPromptType}`, {
        content: promptContent
      });
      message.success(response.data.message);
      setIsEditingPrompt(false);
    } catch (error) {
      console.error('更新提示词失败:', error);
      message.error('更新提示词失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setPromptLoading(false);
    }
  };

  // 查看网页时先确保HTML存在
  const handleViewWebpage = async (record) => {
    // 同步打开窗口避免异步请求后被浏览器拦截；HTML 通过带凭证的 API 获取。
    const preview = window.open('about:blank', '_blank');
    if (!preview) {
      message.error('请允许弹出窗口后重试');
      return;
    }
    preview.opener = null;
    preview.document.title = '正在加载总结';
    preview.document.body.textContent = '正在加载总结网页…';
    let blobUrl;
    try {
      await api.get(`/summaries/${record._id}/ensure-html`);
      const response = await api.get(`/summaries/${record._id}/html`, { responseType: 'text' });
      if (preview.closed) return;
      // Blob 不继承 HTTP CSP，必须在沙箱中显示，并限制外部资源和连接。
      const policy = "default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
      const html = `<meta http-equiv="Content-Security-Policy" content="${policy}">${response.data}`;
      blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const frame = preview.document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.title = '总结网页';
      frame.style.cssText = 'border:0;width:100%;height:100vh;display:block';
      frame.src = blobUrl;
      preview.document.title = '总结网页';
      preview.document.body.style.margin = '0';
      preview.document.body.replaceChildren(frame);
      preview.addEventListener('pagehide', () => URL.revokeObjectURL(blobUrl), { once: true });
    } catch (err) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      preview.close();
      console.error('加载HTML失败:', err);
      message.error('生成或打开网页失败: ' + (err.response?.data?.message || err.message));
    }
  };

  // 获取提示词类型的中文名称
  const getPromptTypeText = (type) => {
    switch (type) {
      case 'daily': return '每日总结提示词';
      case 'weekly': return '每周总结提示词';
      case 'monthly': return '月度总结提示词';
      case 'yearly': return '年度总结提示词';
      default: return '提示词';
    }
  };

  // 标记总结为已读
  const markAsRead = async (summaryId, type) => {
    try {
      await api.put(`/summaries/${summaryId}/read`);
      message.success('已标记为已读');
      // 刷新数据
      fetchSummaries(type);
      fetchUnreadCounts();
      // 触发导航栏更新
      window.dispatchEvent(new CustomEvent('summariesUpdated'));
    } catch (error) {
      console.error('标记已读失败:', error);
      message.error('标记已读失败');
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
      render: (text, record) => {
        if (record.type === 'monthly') {
          return moment(text).format('YYYY年M月');
        }
        if (record.type === 'weekly') {
          // 优先使用后端提供的范围标签
          return record.meta?.rangeLabel || getWeeklyRangeLabel(text);
        }
        if (record.type === 'yearly') {
          return moment(text).format('YYYY年');
        }
        return moment(text).format('YYYY-MM-DD');
      },
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
      title: '状态',
      dataIndex: 'isRead',
      key: 'isRead',
      render: (isRead) => (
        <Tag color={isRead ? 'green' : 'orange'}>
          {isRead ? '已读' : '未读'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<FileTextOutlined />} 
            size="small"
            onClick={() => {
              setSelectedSummary(record);
              // 如果是未读状态，自动标记为已读
              if (!record.isRead) {
                markAsRead(record._id, type);
              }
            }}
          >
            查看详情
          </Button>
          {!record.isRead && (
            <Button 
              size="small"
              type="default"
              onClick={() => markAsRead(record._id, type)}
            >
              标记已读
            </Button>
          )}
          {(type === 'weekly' || type === 'monthly' || type === 'yearly') && (
            <Button 
              icon={<LinkOutlined />} 
              size="small"
              type="primary"
              onClick={() => handleViewWebpage(record)}
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
    },
    // 每周总结专属：范围与生成方式说明（移到操作列之后）
    ...(type === 'weekly' ? [{
      title: '说明',
      key: 'metaInfo',
      render: (_, record) => {
        if (record.type !== 'weekly') return '';
        const rangeLabel = record.meta?.rangeLabel || getWeeklyRangeLabel(record.date);
        const gen = record.meta?.generatedBy === 'auto' ? '自动（上一周）' : record.meta?.generatedBy === 'manual' ? '手动（本周）' : '未知';
        const llmText = record.meta?.llmUsed === 'none' ? '未使用LLM' : (record.meta?.llmName || '未知LLM');
        return (
          <span>
            范围：{rangeLabel}；生成方式：{gen}；LLM：{llmText}
          </span>
        );
      }
    }] : [])
  ];

  const renderSummaryTable = (summaries, type) => {
    const currentLoading = loading[type];
    const currentPagination = pagination[type];
    
    if (isMobile) {
      // 移动端卡片渲染，内容摘要截断到50个字符
      const renderCardItem = (summary) => {
        const typeTagColor = getTypeColor(summary.type);
        const typeText = getTypeText(summary.type);
        const dateText = getTitleDateText(summary);
        const isRead = summary.isRead;
        const createdAtText = moment(summary.createdAt).format('YYYY-MM-DD HH:mm');
        const contentRaw = summary.content || '';
        const contentSnippet = contentRaw
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 50) + (contentRaw.length > 50 ? '…' : '');

        return (
          <List.Item key={summary._id} style={{ padding: '8px 12px' }}>
            <Card
              hoverable
              size="small"
              style={{ width: '100%' }}
              onClick={() => {
                setSelectedSummary(summary);
                if (!summary.isRead) {
                  markAsRead(summary._id, summary.type);
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size="small" wrap>
                  <Tag color={typeTagColor}>{typeText}</Tag>
                  <Tag color={isRead ? 'green' : 'orange'}>{isRead ? '已读' : '未读'}</Tag>
                </Space>
                <span style={{ fontSize: 12, color: '#666' }}>{createdAtText}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: '#333' }}>
                <strong style={{ color: '#1890ff' }}>{dateText}</strong>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
                {contentSnippet || '（无内容）'}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                {(summary.type === 'weekly' || summary.type === 'monthly' || summary.type === 'yearly') && (
                  <Button 
                    icon={<LinkOutlined />} 
                    size="small"
                    type="primary"
                    onClick={(e) => { e.stopPropagation(); handleViewWebpage(summary); }}
                  >
                    查看网页
                  </Button>
                )}
                <Popconfirm
                  title="确认删除"
                  description="确定要删除这个总结吗？此操作不可恢复。"
                  onConfirm={(e) => { e?.stopPropagation?.(); handleDeleteSummary(summary._id, summary.type); }}
                  okText="确定"
                  cancelText="取消"
                  placement="topRight"
                >
                  <Button 
                    icon={<DeleteOutlined />} 
                    size="small"
                    danger
                    type="text"
                    onClick={(e) => e.stopPropagation()}
                  >
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </Card>
          </List.Item>
        );
      };

      return (
        <List
          dataSource={summaries}
          renderItem={renderCardItem}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={`暂无${getTypeText(type)}`}
              />
            )
          }}
          pagination={{
            current: currentPagination.current,
            pageSize: currentPagination.pageSize,
            total: currentPagination.total,
            onChange: (page, pageSize) => handleTableChange({ ...currentPagination, current: page, pageSize }, type)
          }}
        />
      );
    }

    // 桌面端表格渲染
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
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 24 }}>
        <img 
          src={process.env.PUBLIC_URL + '/pic/logo5.png'} 
          alt="工作总结"
          style={{ 
            height: '80px', 
            width: 'auto', 
            objectFit: 'contain', 
            display: 'block' 
          }} 
        />
      </div>
      
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
                每日总结{unreadCounts.daily > 0 && `（${unreadCounts.daily}）`}
              </span>
            ),
            children: (
              <Card 
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>每日工作总结</span>
                    <Space>
                      <Button 
                        type="text" 
                        icon={<EyeOutlined />}
                        onClick={() => handleViewPrompt('daily')}
                        size="small"
                        title="查看提示词"
                      >
                        查看提示词
                      </Button>
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
            key: 'weekly',
            label: (
              <span>
                <BarChartOutlined />
                每周总结{unreadCounts.weekly > 0 && `（${unreadCounts.weekly}）`}
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>每周工作总结</span>
                    <Space>
                      <Button 
                        type="text" 
                        icon={<EyeOutlined />}
                        onClick={() => handleViewPrompt('weekly')}
                        size="small"
                        title="查看提示词"
                      >
                        查看提示词
                      </Button>
                      <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        loading={generateWeeklyLoading}
                        onClick={handleGenerateWeeklySummary}
                        size="small"
                        style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                      >
                        立即生成每周总结
                      </Button>
                      <Button
                        type="default"
                        icon={<ReloadOutlined />}
                        loading={regenerateLastWeeklyLoading}
                        onClick={handleRegenerateLastWeeklySummary}
                        size="small"
                      >
                        重新生成上周总结
                      </Button>
                    </Space>
                  </div>
                }
              >
                {renderSummaryTable(weeklySummaries, 'weekly')}
              </Card>
            )
          },
          {
            key: 'monthly',
            label: (
              <span>
                <BarChartOutlined />
                月底总结{unreadCounts.monthly > 0 && `（${unreadCounts.monthly}）`}
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>月度工作总结</span>
                    <Space>
                      <Button 
                        type="text" 
                        icon={<EyeOutlined />}
                        onClick={() => handleViewPrompt('monthly')}
                        size="small"
                        title="查看提示词"
                      >
                        查看提示词
                      </Button>
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
                年底总结{unreadCounts.yearly > 0 && `（${unreadCounts.yearly}）`}
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>年度工作总结</span>
                    <Space>
                      <DatePicker 
                        picker="year" 
                        value={generateYear} 
                        onChange={setGenerateYear} 
                        allowClear={false}
                        style={{ width: 100 }}
                        disabled={generateYearlyLoading}
                        size="small"
                      />
                      <Button 
                        type="text" 
                        icon={<EyeOutlined />}
                        onClick={() => handleViewPrompt('yearly')}
                        size="small"
                        title="查看提示词"
                      >
                        查看提示词
                      </Button>
                      <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        loading={generateYearlyLoading}
                        onClick={handleGenerateYearlySummary}
                        size="small"
                        style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                      >
                        生成{generateYear ? generateYear.year() : ''}年度总结
                      </Button>
                    </Space>
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
        title={`${selectedSummary ? getTypeText(selectedSummary.type) : ''} - ${selectedSummary ? getTitleDateText(selectedSummary) : ''}`}
        open={!!selectedSummary}
        onCancel={() => setSelectedSummary(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedSummary(null)}>
            关闭
          </Button>
        ]}
        width={800}
        styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
      >
        {selectedSummary && (
          <div style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#333'
          }}>
            {selectedSummary.type === 'weekly' && (
              <div style={{
                marginBottom: '12px',
                padding: '8px 12px',
                background: '#f6f8ff',
                border: '1px solid #e6f7ff',
                borderRadius: '6px',
                color: '#595959'
              }}>
                <strong style={{ color: '#1890ff' }}>范围：</strong>
                {selectedSummary.meta?.rangeLabel || getWeeklyRangeLabel(selectedSummary.date)}
                <span style={{ margin: '0 8px' }}>|</span>
                <strong style={{ color: '#1890ff' }}>生成方式：</strong>
                {selectedSummary.meta?.generatedBy === 'auto' ? '自动（上一周）' : selectedSummary.meta?.generatedBy === 'manual' ? '手动（本周）' : '未知'}
                <span style={{ margin: '0 8px' }}>|</span>
                <strong style={{ color: '#1890ff' }}>LLM：</strong>
                {selectedSummary.meta?.llmUsed === 'external' ? '外部LLM' : selectedSummary.meta?.llmUsed === 'local' ? '本地LLM' : '未使用LLM'}
              </div>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({children}) => <h2 style={{color: '#1890ff', borderBottom: '2px solid #1890ff', paddingBottom: '8px'}}>{children}</h2>,
                h2: ({children}) => <h3 style={{color: '#1890ff', marginTop: '24px', marginBottom: '12px'}}>{children}</h3>,
                h3: ({children}) => <h4 style={{color: '#666', marginTop: '20px', marginBottom: '10px'}}>{children}</h4>,
                p: ({children}) => <p style={{marginBottom: '12px', textAlign: 'justify'}}>{children}</p>,
                ul: ({children}) => <ul style={{paddingLeft: '20px', marginBottom: '12px'}}>{children}</ul>,
                ol: ({children}) => <ol style={{paddingLeft: '20px', marginBottom: '12px'}}>{children}</ol>,
                li: ({children}) => <li style={{marginBottom: '4px'}}>{children}</li>,
                strong: ({children}) => <strong style={{color: '#1890ff', fontWeight: 600}}>{children}</strong>,
                em: ({children}) => <em style={{color: '#666', fontStyle: 'italic'}}>{children}</em>,
                blockquote: ({children}) => (
                  <blockquote style={{
                    borderLeft: '4px solid #1890ff',
                    paddingLeft: '16px',
                    margin: '16px 0',
                    backgroundColor: '#f6f8ff',
                    padding: '12px 16px',
                    borderRadius: '4px'
                  }}>
                    {children}
                  </blockquote>
                ),
                code: ({children}) => (
                  <code style={{
                    backgroundColor: '#f5f5f5',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '13px',
                    fontFamily: 'Monaco, Consolas, monospace'
                  }}>
                    {children}
                  </code>
                ),
                pre: ({children}) => (
                  <pre style={{
                    backgroundColor: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '6px',
                    overflow: 'auto',
                    fontSize: '13px',
                    fontFamily: 'Monaco, Consolas, monospace',
                    border: '1px solid #e8e8e8'
                  }}>
                    {children}
                  </pre>
                )
              }}
            >
              {selectedSummary.content}
            </ReactMarkdown>
          </div>
        )}
      </Modal>

      <Modal
        title={getPromptTypeText(currentPromptType)}
        open={promptModalVisible}
        onCancel={() => {
          setPromptModalVisible(false);
          setIsEditingPrompt(false);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setPromptModalVisible(false);
            setIsEditingPrompt(false);
          }}>
            取消
          </Button>,
          !isEditingPrompt ? (
            <Button 
              key="edit" 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => setIsEditingPrompt(true)}
            >
              编辑
            </Button>
          ) : (
            <Button 
              key="save" 
              type="primary" 
              loading={promptLoading}
              onClick={handleUpdatePrompt}
            >
              保存
            </Button>
          )
        ]}
        width={800}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
      >
        <Spin spinning={promptLoading}>
          {isEditingPrompt ? (
            <TextArea
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              rows={20}
              placeholder="请输入提示词内容..."
            />
          ) : (
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              backgroundColor: '#f5f5f5',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {promptContent}
            </pre>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default SummaryList;