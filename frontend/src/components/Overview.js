import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Skeleton, Statistic } from 'antd';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import dayjs from 'dayjs';
import api from '../utils/api';
import PageHeading from './PageHeading';
import Calendar from './Calendar';
const palette = ['#527554', '#96a886', '#b4bb9c', '#c8bda1', '#8c9e92', '#a6b4aa'];
export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setError(false);
    api.get('/diaries/dashboard', { params: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).then(r => { if (active) setData(r.data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [revision]);
  const days = Object.fromEntries((data?.days || []).map(d => [d._id, d.hours]));
  const trend = Array.from({ length: 30 }, (_, i) => { const date = dayjs().subtract(29 - i, 'day'); return { date: date.format('MM-DD'), hours: days[date.format('YYYY-MM-DD')] || 0 }; });
  return <div className="overview-page"><PageHeading eyebrow="THE BIGGER PICTURE" title="数据概览" description="回看记录的积累，也为下一步找到参考。" />
    {error && <Alert type="error" message="概览加载失败" action={<Button onClick={() => setRevision(n => n + 1)}>重试</Button>} />}
    {!data ? <Skeleton active /> : <>
      <Row gutter={[20,20]} style={{ marginBottom:24 }}>{[['累计工作记录',data.stats.totalDiaries,'/app/diaries'],['今天的记录',data.stats.todayDiaries,`/app/diaries?date=${dayjs().format('YYYY-MM-DD')}`],['工作总结',data.stats.totalSummaries,'/app/summaries']].map(([label,value,path]) => <Col xs={24} sm={8} key={label}><Link to={path}><Card><Statistic title={label} value={value} valueStyle={{ color:'#46663f', fontSize:30 }} /></Card></Link></Col>)}</Row>
      <Row gutter={[20,20]}><Col xs={24} lg={12}><Card title="工作标签分布"><ResponsiveContainer width="100%" height={270}><PieChart><Pie data={data.tags} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={3} label={({ name }) => name}>{data.tags.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></Card></Col><Col xs={24} lg={12}><Card title="月度记录与工时"><ResponsiveContainer width="100%" height={270}><BarChart data={data.months}><CartesianGrid stroke="#edf0e8" vertical={false} /><XAxis dataKey="name" tick={{ fontSize:11 }} axisLine={false} tickLine={false} /><YAxis yAxisId="entries" tick={{ fontSize:11 }} axisLine={false} tickLine={false} /><YAxis yAxisId="hours" orientation="right" tick={{ fontSize:11 }} axisLine={false} tickLine={false} /><Tooltip /><Bar yAxisId="entries" dataKey="entries" name="记录数" fill="#527554" radius={[3,3,0,0]} /><Bar yAxisId="hours" dataKey="totalHours" name="工作时长（小时）" fill="#b4bb9c" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></Card></Col><Col span={24}><Card title="近 30 天记录工时"><ResponsiveContainer width="100%" height={240}><LineChart data={trend}><CartesianGrid stroke="#edf0e8" vertical={false} /><XAxis dataKey="date" interval={4} tick={{ fontSize:11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize:11 }} axisLine={false} tickLine={false} /><Tooltip /><Line dataKey="hours" name="工时（小时）" stroke="#63845b" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></Card></Col></Row>
    </>}
    <div style={{ marginTop:24 }}><Calendar /></div>
  </div>;
}
