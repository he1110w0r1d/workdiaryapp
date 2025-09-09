import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin, Badge } from 'antd';
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
  const [loading, setLoading] = useState(true);
  const [tagData, setTagData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [dailyTrendData, setDailyTrendData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 并行获取所有需要的数据
      const [diaryRes, summaryRes, monthlyWorkRes] = await Promise.all([
        api.get('/diaries?limit=1000'), // 获取所有日记用于统计
        api.get('/summaries'),
        fetchMonthlyWorkData() // 获取月度工作数据
      ]);

      // 生成日工作趋势数据
      const dailyTrend = generateDailyTrendData(diaryRes.data.diaries);
      setDailyTrendData(dailyTrend);

      const diaries = diaryRes.data.diaries;
      const today = new Date().toDateString();
      const todayDiaries = diaries.filter(diary => 
        new Date(diary.createdAt).toDateString() === today
      ).length;

      setStats({
        totalDiaries: diaries.length,
        todayDiaries: todayDiaries,
        totalSummaries: summaryRes.data.total
      });

      // 生成标签数据
      const tagCount = {};
      diaries.forEach(diary => {
        diary.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      });

      const tagDataArray = Object.entries(tagCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
      setTagData(tagDataArray);

      // 设置月度工作数据
      setMonthlyData(monthlyWorkRes);

    } catch (error) {
      console.error('获取仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 生成日工作趋势数据（最近30天）
  const generateDailyTrendData = (diaries) => {
    const dailyStats = {};
    const today = moment();
    
    // 初始化最近30天的数据
    for (let i = 29; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      const dateKey = date.format('YYYY-MM-DD');
      const dateLabel = date.format('MM-DD');
      dailyStats[dateKey] = {
        date: dateLabel,
        hours: 0
      };
    }
    
    // 统计每日工作时长
    diaries.forEach(diary => {
      const diaryDate = moment(diary.startTime).format('YYYY-MM-DD');
      if (dailyStats[diaryDate]) {
        // 计算工作时长（小时）
        const workDuration = (new Date(diary.endTime) - new Date(diary.startTime)) / (1000 * 60 * 60);
        dailyStats[diaryDate].hours += workDuration;
      }
    });
    
    // 转换为数组格式
    return Object.values(dailyStats);
  };

  // 获取月度工作数据
  const fetchMonthlyWorkData = async () => {
    try {
      const diaryRes = await api.get('/diaries?limit=1000');
      const diaries = diaryRes.data.diaries;
      
      // 按月份分组统计工作条目数和工作时长
      const monthlyStats = {};
      
      diaries.forEach(diary => {
        const date = new Date(diary.startTime);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = `${date.getFullYear()}年${date.getMonth() + 1}月`;
        
        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = {
            name: monthName,
            entries: 0,
            totalHours: 0
          };
        }
        
        // 计算工作时长（小时）
        const workDuration = (new Date(diary.endTime) - new Date(diary.startTime)) / (1000 * 60 * 60);
        
        monthlyStats[monthKey].entries += 1;
        monthlyStats[monthKey].totalHours += workDuration;
      });
      
      // 转换为数组并按日期排序
      const monthlyDataArray = Object.values(monthlyStats)
        .sort((a, b) => {
          const dateA = new Date(a.name.replace('年', '-').replace('月', '-01'));
          const dateB = new Date(b.name.replace('年', '-').replace('月', '-01'));
          return dateA - dateB;
        })
        .slice(-12); // 只显示最近12个月的数据
      
      return monthlyDataArray;
    } catch (error) {
      console.error('获取月度工作数据失败:', error);
      return [];
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7300'];

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <Title level={2}>日记看板</Title>
      
      {/* 日历组件 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Calendar />
        </Col>
      </Row>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Badge.Ribbon text="总览" color="blue">
            <Card 
              hoverable
              onClick={() => navigate('/app/diaries')}
              style={{ 
                cursor: 'pointer',
                background: currentTheme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '12px'
              }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>总工作日记</span>}
                value={stats.totalDiaries}
                valueStyle={{ color: 'white', fontSize: '2em' }}
                prefix={<FileTextOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.2em' }} />}
                suffix={<TrophyOutlined style={{ color: 'rgba(255,255,255,0.9)', marginLeft: '8px' }} />}
              />
            </Card>
          </Badge.Ribbon>
        </Col>
        <Col span={8}>
          <Badge.Ribbon text="今日" color="green">
            <Card 
              hoverable
              onClick={() => {
                const today = moment().format('YYYY-MM-DD');
                navigate(`/app/diaries?date=${today}`);
              }}
              style={{ 
                cursor: 'pointer',
                background: currentTheme.colors.secondary,
                color: 'white',
                border: 'none',
                borderRadius: '12px'
              }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>今日新增</span>}
                value={stats.todayDiaries}
                valueStyle={{ color: 'white', fontSize: '2em' }}
                prefix={<ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.2em' }} />}
                suffix={<FireOutlined style={{ color: 'rgba(255,255,255,0.9)', marginLeft: '8px' }} />}
              />
            </Card>
          </Badge.Ribbon>
        </Col>
        <Col span={8}>
          <Badge.Ribbon text="报告" color="purple">
            <Card 
              hoverable
              onClick={() => navigate('/summaries')}
              style={{ 
                cursor: 'pointer',
                background: currentTheme.colors.accent,
                color: 'white',
                border: 'none',
                borderRadius: '12px'
              }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>总结报告</span>}
                value={stats.totalSummaries}
                valueStyle={{ color: 'white', fontSize: '2em' }}
                prefix={<BarChartOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.2em' }} />}
                suffix={<RocketOutlined style={{ color: 'rgba(255,255,255,0.9)', marginLeft: '8px' }} />}
              />
            </Card>
          </Badge.Ribbon>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="工作标签分布">
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
        <Col span={12}>
          <Card title="月度工作趋势">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'entries') return [value, '条目数'];
                    if (name === 'totalHours') return [value.toFixed(1), '小时'];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="entries" fill="#8884d8" name="工作条目数" />
                <Bar yAxisId="right" dataKey="totalHours" fill="#82ca9d" name="工作时长" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 日工作趋势折线图 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="日工作时长趋势（最近30天）">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval={4} // 每5个点显示一个标签
                />
                <YAxis 
                  domain={[0, 'dataMax + 2']} 
                  tick={{ fontSize: 12 }}
                  label={{ value: '工作时长(小时)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value) => [`${value.toFixed(1)}`, '工作时长']}
                  labelFormatter={(label) => `日期: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="#1890ff" 
                  strokeWidth={2}
                  dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#1890ff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 如果需要单独显示工作时长趋势，可以添加这个卡片 */}
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