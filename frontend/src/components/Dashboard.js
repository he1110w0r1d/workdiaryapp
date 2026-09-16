import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Skeleton, Tag } from 'antd';
import { ArrowRightOutlined, PlusOutlined, FileTextOutlined, CheckCircleOutlined, ReadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';
import PageHeading from './PageHeading';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [capture, setCapture] = useState('');
  const captureOwner = useRef(null);
  const [captureKey, setCaptureKey] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  useEffect(() => { const timer = setInterval(() => setDate(dayjs().format('YYYY-MM-DD')), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const requests = {
      stats: api.get('/diaries/dashboard', { params: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
      todos: api.get('/todos', { params: { status: '待办', dueBefore: dayjs().add(7, 'day').endOf('day').toISOString(), limit: 5 } }),
      today: api.get('/diaries', { params: { startDate: date, endDate: date, limit: 5 } }),
      recent: api.get('/diaries', { params: { limit: 3 } }),
      profile: api.get('/users/profile')
    };
    Promise.allSettled(Object.values(requests)).then(results => {
      if (!active) return;
      const next = {}; const failed = [];
      Object.keys(requests).forEach((key, i) => { if (results[i].status === 'fulfilled') next[key] = results[i].value.data; else failed.push(key); });
      setData(next); setErrors(failed); setLoading(false);
      if (next.profile?._id) {
        const key = `workdiary-capture:${next.profile._id}`;
        setCaptureKey(key);
        if (captureOwner.current !== key) {
          captureOwner.current = key;
          try { const saved = sessionStorage.getItem(key) || ''; setCapture(current => current || saved); } catch (_) { setStorageError(true); }
        }
      }
    });
    return () => { active = false; };
  }, [revision, date]);
  const updateCapture = value => {
    setCapture(value);
    try { if (captureKey) sessionStorage.setItem(captureKey, value); else setStorageError(true); } catch (_) { setStorageError(true); }
  };
  const hour = dayjs().hour();
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const today = data.today?.diaries || [];
  const tasks = data.todos?.todos || [];
  const stats = data.stats?.stats;
  const failed = key => errors.includes(key) ? <p className="muted">暂时无法读取，请重试。</p> : null;
  return <div className="today-page">
    <PageHeading eyebrow={dayjs(date).format('YYYY 年 M 月 D 日 · dddd')} title={`${greeting}，从这里继续。`} description="把重要的事放在眼前，给今天留下一点记录。" actions={<Link className="subtle-link" to="/app/overview">查看概览 <ArrowRightOutlined /></Link>} />
    {errors.length > 0 && <Alert showIcon type="warning" message="部分内容暂时未能加载，其他功能仍可使用。" action={<Button size="small" onClick={() => setRevision(v => v + 1)}>重试</Button>} />}
    <div className="today-grid"><div className="today-primary">
      <section className="capture-panel"><div className="section-heading"><h2><FileTextOutlined /> 记下此刻的进展</h2><span className="quiet-label">QUICK NOTE</span></div>
        <Input.TextArea aria-label="快速记录工作内容" value={capture} onChange={e => updateCapture(e.target.value)} autoSize={{ minRows: 4, maxRows: 9 }} maxLength={20000} placeholder="刚完成了什么？遇到了什么问题？先写下来……" />
        <div className="capture-footer"><span>{storageError ? '草稿暂未缓存，请继续到编辑页保存' : capture ? '草稿保留在当前标签页，尚未提交' : '先写内容，再补充工作时间。'}</span><Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate('/app/diaries/new', { state: { captureContent: capture, captureKey } })}>{capture.trim() ? '继续编辑并保存' : '开始记录'}</Button></div>
      </section>
      <section className="workspace-panel"><div className="section-heading"><h2>今天的记录 <span className="heading-count">{data.today?.total ?? '—'}</span></h2><Link to={`/app/diaries?date=${date}`} className="subtle-link">查看全部 <ArrowRightOutlined /></Link></div>
        {loading ? <Skeleton active paragraph={{ rows: 3 }} /> : failed('today') || (today.length ? <div className="day-timeline">{today.map(entry => <Link key={entry._id} to={`/app/diaries/${entry._id}/edit`} className="timeline-entry"><time>{dayjs(entry.startTime).format('HH:mm')}</time><div><p>{entry.content}</p><span>{entry.tags?.join(' · ') || '工作记录'}<span className="entry-duration">{Math.round((new Date(entry.endTime) - new Date(entry.startTime)) / 60000)} 分钟</span></span></div><ArrowRightOutlined /></Link>)}</div> : <div className="calm-empty"><FileTextOutlined /><h3>今天，等你写下第一笔。</h3><p>一次沟通、一项进展，都值得留下。</p><Link to="/app/diaries/new">记录今天 <ArrowRightOutlined /></Link></div>)}
      </section>
      <section className="recent-section"><div className="section-heading"><h2>最近的工作</h2><Link to="/app/diaries" className="subtle-link">所有日记 <ArrowRightOutlined /></Link></div>
        {loading ? <Skeleton paragraph={{ rows: 2 }} /> : failed('recent') || (data.recent?.diaries?.length ? data.recent.diaries.map(entry => <Link className="recent-entry" key={entry._id} to={`/app/diaries/${entry._id}/edit`}><FileTextOutlined /><span>{entry.content}</span><time>{dayjs(entry.startTime).format('MM-DD')}</time><ArrowRightOutlined /></Link>) : <p className="muted">保存的工作记录会出现在这里。</p>)}
      </section>
    </div><aside className="today-secondary">
      <section className="workspace-panel todo-focus"><div className="section-heading"><h2>接下来要做</h2><Link to="/app/todos?new=1" aria-label="新增待办" className="subtle-link"><PlusOutlined /></Link></div><p className="section-description">逾期及未来 7 天到期 · {data.todos?.pagination?.total ?? '—'} 项</p>
        {loading ? <Skeleton active paragraph={{ rows: 3 }} /> : failed('todos') || (tasks.length ? <div>{tasks.map(todo => <Link className="focus-task" to="/app/todos" key={todo._id}><ArrowRightOutlined className="task-open" /><div><p>{todo.content}</p><span className={dayjs(todo.dueDate).isBefore(dayjs()) ? 'overdue' : 'muted'}><ClockCircleOutlined /> {dayjs(todo.dueDate).isBefore(dayjs()) ? '已逾期 · ' : ''}{dayjs(todo.dueDate).format('MM-DD HH:mm')}</span>{todo.priority === '高' && <Tag color="warning">高优先级</Tag>}</div></Link>)}</div> : <div className="calm-empty compact"><CheckCircleOutlined /><h3>暂时没有临近的截止时间</h3><p>可以安排下一步，也可以专注眼前。</p></div>)}
        <Link className="panel-bottom-link" to="/app/todos">查看全部待办 <ArrowRightOutlined /></Link>
      </section>
      <section className="review-panel"><ReadOutlined /><span className="eyebrow">留一点时间，回看这一天</span><h2>零散记录，<br />也能理出清晰脉络。</h2><p>基于已保存的日记，整理日报、周报和月报。</p><Link to="/app/summaries">整理工作总结 <ArrowRightOutlined /></Link></section>
      <div className="quiet-stats"><Link to="/app/diaries"><strong>{stats?.totalDiaries ?? '—'}</strong><span>累计记录</span></Link><Link to="/app/summaries"><strong>{stats?.totalSummaries ?? '—'}</strong><span>工作总结</span></Link></div>
    </aside></div>
  </div>;
}
