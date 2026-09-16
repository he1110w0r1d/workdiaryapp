import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin, Badge, Button, Space, List, Alert } from 'antd';
import { 
  FileTextOutlined, 
  BarChartOutlined, 
  ClockCircleOutlined,
  TrophyOutlined,
  FireOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import moment from 'moment';
import Calendar from './Calendar';

const { Title } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const currentTheme = {
    colors: {
      primary: '#1E3A8A',
      secondary: '#2563EB', 
      accent: '#3B82F6'
    }
  };
  const [stats, setStats] = useState({
    totalDiaries: 0,
    todayDiaries: 0,
    totalSummaries: 0
  });
  const [urgentTodos, setUrgentTodos] = useState([]);
  const [urgentTotal, setUrgentTotal] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tagData, setTagData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [dailyTrendData, setDailyTrendData] = useState([]);
  // 删除词云数据状态
  // const [wordCloudData, setWordCloudData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true); setError(false);
    try {
      const [response, tasks] = await Promise.all([
        api.get('/diaries/dashboard', { params: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
        api.get('/todos', { params: { status: '待办', dueBefore: moment().add(7, 'days').endOf('day').toISOString(), limit: 5 } })
      ]);
      const data = response.data;
      setStats(data.stats); setTagData(data.tags); setMonthlyData(data.months);
      const days = Object.fromEntries(data.days.map(d => [d._id, d.hours]));
      setDailyTrendData(Array.from({ length: 30 }, (_, i) => {
        const date = moment().subtract(29 - i, 'days');
        return { date: date.format('MM-DD'), hours: days[date.format('YYYY-MM-DD')] || 0 };
      }));
      setUrgentTodos(tasks.data.todos); setUrgentTotal(tasks.data.pagination.total);
    } catch (_) { setError(true); }
    finally { setLoading(false); }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7300'];

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <div>
      
      {error && <Alert type="error" message="部分数据加载失败" action={<Button onClick={fetchDashboardData}>重试</Button>} />}
      <Card title="今天的工作" style={{ marginBottom: 24 }} extra={<Space wrap>
        <Button type="primary" onClick={() => navigate('/app/diaries/new')}>记一笔工作</Button>
        <Button onClick={() => navigate('/app/todos?new=1')}>新增待办</Button>
      </Space>}>
        <p>今天已有 {stats.todayDiaries} 条工作记录。<Button type="link" onClick={() => navigate(`/app/diaries?date=${moment().format('YYYY-MM-DD')}`)}>查看今天</Button>
          <Button type="link" onClick={() => navigate('/app/summaries')}>生成工作总结</Button></p>
        <List header={`逾期及未来 7 天到期：${urgentTotal} 项`} dataSource={urgentTodos} locale={{ emptyText: '暂无即将到期的待办' }} renderItem={todo => <List.Item>
          <Button type="link" onClick={() => navigate('/app/todos')}>{todo.content}</Button>
          <span style={{ color: moment(todo.dueDate).isBefore(moment()) ? '#cf1322' : undefined }}>{moment(todo.dueDate).isBefore(moment()) ? '已逾期 · ' : ''}{moment(todo.dueDate).format('MM-DD HH:mm')}</span>
        </List.Item>} />
        {urgentTotal > 5 && <Button onClick={() => navigate('/app/todos')}>查看全部待办</Button>}
      </Card>
      {/* 日历组件 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24} style={{ padding: isMobile ? '0' : undefined }}>
          <Calendar />
        </Col>
      </Row>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card 
            hoverable
            onClick={() => navigate('/app/diaries')}
            style={{ 
              cursor: 'pointer',
              background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.3s ease'
            }}
            styles={{ body: { padding: '24px' } }}
          >
            <Statistic
              title={<span style={{ color: '#64748b', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>全部工作记录</span>}
              value={stats.totalDiaries}
              valueStyle={{ color: '#1e293b', fontSize: '32px', fontWeight: 800, fontFamily: 'Inter, -apple-system, sans-serif' }}
              prefix={
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 20,
                  boxShadow: 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.5)'
                }}>
                  <FileTextOutlined style={{ color: '#3b82f6', fontSize: '28px' }} />
                </div>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} style={{ marginTop: isMobile ? 16 : 0 }}>
          <Card 
            hoverable
            onClick={() => {
              const today = moment().format('YYYY-MM-DD');
              navigate(`/app/diaries?date=${today}`);
            }}
            style={{ 
              cursor: 'pointer',
              background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.3s ease'
            }}
            styles={{ body: { padding: '24px' } }}
          >
            <Statistic
              title={<span style={{ color: '#64748b', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>今天的工作记录</span>}
              value={stats.todayDiaries}
              valueStyle={{ color: '#1e293b', fontSize: '32px', fontWeight: 800, fontFamily: 'Inter, -apple-system, sans-serif' }}
              prefix={
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 20,
                  boxShadow: 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.5)'
                }}>
                  <ClockCircleOutlined style={{ color: '#10b981', fontSize: '28px' }} />
                </div>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} style={{ marginTop: isMobile ? 16 : 0 }}>
          <Card 
            hoverable
            onClick={() => navigate('/app/summaries')}
            style={{ 
              cursor: 'pointer',
              background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.3s ease'
            }}
            styles={{ body: { padding: '24px' } }}
          >
            <Statistic
              title={<span style={{ color: '#64748b', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summaries</span>}
              value={stats.totalSummaries}
              valueStyle={{ color: '#1e293b', fontSize: '32px', fontWeight: 800, fontFamily: 'Inter, -apple-system, sans-serif' }}
              prefix={
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 20,
                  boxShadow: 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.5)'
                }}>
                  <BarChartOutlined style={{ color: '#8b5cf6', fontSize: '28px' }} />
                </div>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card 
            title="工作标签分布" 
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: 'none' }}
            styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tagData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tagData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, '条目数']} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={12} style={{ marginTop: isMobile ? 12 : 0 }}>
          <Card 
            title="月度工作趋势"
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: 'none' }}
            styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#64748b" axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value, name) => {
                    if (name === 'entries') return [value, '条目数'];
                    if (name === 'totalHours') return [Number(value).toFixed(1), '小时'];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="entries" fill="#8884d8" radius={[4, 4, 0, 0]} name="工作条目数" />
                <Bar yAxisId="right" dataKey="totalHours" fill="#82ca9d" radius={[4, 4, 0, 0]} name="工作时长" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 日工作趋势折线图 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card 
            title="日工作时长趋势（最近30天）"
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: 'none' }}
            styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
          >
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
              <LineChart data={dailyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  interval={4} // 每5个点显示一个标签
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  domain={[0, 'dataMax + 2']} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  label={{ value: '工作时长(小时)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [Number(value).toFixed(1), '小时']}
                  labelStyle={{ color: '#64748b' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="#f59e0b" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                  name="工作时长" 
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
      {/* workHoursData 功能暂未实现，先注释掉
      {workHoursData.length > 0 && (
        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title="月度工作时长统计">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={workHoursData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value.toFixed(1)}小时`, '工作时长']} />
                  <Bar dataKey="hours" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}
      */}
    </div>
  );
};

export default Dashboard;
