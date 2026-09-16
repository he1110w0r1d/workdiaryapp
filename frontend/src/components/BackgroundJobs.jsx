import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, DatePicker, List, Select, Space, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import api from '../utils/api';

const statuses = { queued: '排队中', running: '处理中', succeeded: '已完成', failed: '失败' };
const types = { daily: '日报', weekly: '周报', monthly: '月报', yearly: '年报' };
export default function BackgroundJobs({ kind = 'summary', onComplete, onOpen }) {
  const [jobs, setJobs] = useState([]);
  const [type, setType] = useState('daily');
  const [anchor, setAnchor] = useState(dayjs());
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const callback = useRef(onComplete);
  callback.current = onComplete;
  const seen = useRef(new Map());
  const initialized = useRef(false);
  const base = kind === 'summary' ? '/summaries/jobs' : '/rag/sync/jobs';
  useEffect(() => {
    let cancelled = false;
    let timer;
    initialized.current = false;
    const load = async () => {
      try {
        const { data } = await api.get(base);
        if (cancelled) return;
        const latest = data.data || [];
        if (initialized.current && latest.some(j => j.status === 'succeeded' && seen.current.get(j._id) !== 'succeeded')) {
          callback.current?.();
          if (kind === 'summary') window.dispatchEvent(new CustomEvent('summariesUpdated'));
        }
        seen.current = new Map(latest.map(j => [j._id, j.status]));
        initialized.current = true;
        setJobs(latest); setError('');
      } catch (_) { if (!cancelled) setError('任务状态读取失败，将自动重试'); }
      if (!cancelled) timer = setTimeout(load, 5000);
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [base, kind]);
  const request = async (path, body) => {
    setBusy(true);
    try { return (await api.post(path, body)).data; }
    catch (e) { message.error(e.response?.data?.message || '操作未完成'); return null; }
    finally { setBusy(false); }
  };
  const input = { type, anchor: anchor?.format('YYYY-MM-DD') };
  return <Card size="small" title={kind === 'summary' ? '整理一份新的总结' : '检索同步任务'} style={{ marginBottom: 20 }}>
    {kind === 'summary' && <>
      <Space wrap>
        <Select aria-label="总结类型" value={type} options={Object.entries(types).map(([value, label]) => ({ value, label }))} onChange={v => { setType(v); setPreview(null); }} />
        <DatePicker aria-label="统计日期" value={anchor} allowClear={false} onChange={v => { setAnchor(v); setPreview(null); }} />
        <Button type="primary" loading={busy} onClick={async () => { const result = await request(`${base}/preview`, input); if (result) setPreview({ ...result.data, input }); }}>预览统计范围</Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>按北京时间统计所选日期所在的日、周、月或年。生成新版本会保留已有总结；关闭页面后任务继续运行。</Typography.Paragraph>
      {preview && <Alert type={preview.count ? 'info' : 'warning'} style={{ marginBottom: 12 }} message={`${preview.rangeLabel} · ${preview.count} 条日记 · ${preview.totalMinutes} 分钟`} action={<Button disabled={!preview.count} loading={busy} onClick={async () => {
        const result = await request(base, preview.input);
        if (result) { message.success(result.message); setJobs(list => [result.data, ...list.filter(j => j._id !== result.data._id)]); setPreview(null); }
      }}>确认生成新版本</Button>} />}
    </>}
    {error && <Alert type="warning" message={error} />}
    <details className="jobs-history" open={jobs.some(job => job.status === 'running' || job.status === 'queued' || job.status === 'failed') ? true : undefined}>
      <summary>任务记录 · {jobs.filter(job => job.status === 'running' || job.status === 'queued').length} 项处理中{jobs.some(job => job.status === 'failed') ? ' · 有失败任务待处理' : ''}</summary>
    <List size="small" pagination={{ pageSize: 5, hideOnSinglePage: true }} dataSource={jobs} locale={{ emptyText: '暂无任务' }} renderItem={job => <List.Item actions={[
      job.status === 'failed' && <Button key="retry" size="small" loading={busy} onClick={async () => { const result = await request(`${base}/${job._id}/retry`); if (result) { message.success(result.message); setJobs(list => list.map(j => j._id === job._id ? result.data : j)); } }}>重试</Button>,
      job.result?.summaryId && onOpen && <Button key="open" size="small" onClick={() => onOpen(job.result.summaryId)}>查看报告与建议</Button>
    ].filter(Boolean)}>
      <Space direction="vertical" size={0}>
        <Space wrap><Tag color={job.status === 'failed' ? 'error' : job.status === 'succeeded' ? 'success' : 'processing'}>{statuses[job.status]}</Tag><span>{job.rangeLabel || (job.target === 'dify' ? 'Dify 知识库同步' : '问答检索同步')} {types[job.type] || ''}</span></Space>
        <Typography.Text type="secondary">{job.stage} · {dayjs(job.createdAt).format('MM-DD HH:mm')} · 已尝试 {job.attempts} 次{job.error ? ` · ${job.error}` : ''}</Typography.Text>
      </Space>
    </List.Item>} />
    </details>
  </Card>;
}
