import React, { useEffect, useState } from 'react';
import { Alert, Button, DatePicker, Form, Input, List, Modal, Select, Space, Tag, message } from 'antd';
import api from '../utils/api';

export default function SummarySuggestions({ summaryId }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();
  useEffect(() => {
    let live = true;
    setData(null); setError('');
    api.get(`/summaries/${summaryId}/suggestions`).then(r => { if (live) setData(r.data); }).catch(() => { if (live) setError('建议读取失败，请关闭后重试'); });
    return () => { live = false; };
  }, [summaryId]);
  const act = async (item, action, values) => {
    setBusy(true);
    try {
      await api.post(`/summaries/suggestions/${item._id}/${action}`, values);
      if (action === 'accept') window.dispatchEvent(new CustomEvent('todosUpdated'));
      setData((await api.get(`/summaries/${summaryId}/suggestions`)).data);
      setEditing(null);
      message.success(action === 'accept' ? '已确认并创建待办' : '已忽略建议');
    } catch (e) { message.error(e.response?.data?.message || '操作未完成，可重试'); }
    finally { setBusy(false); }
  };
  return <div style={{ marginBottom: 20 }}>
    {error && <Alert type="warning" message={error} />}
    {data?.sourceStatus === 'changed' && <Alert type="warning" showIcon message={`原始日记已有 ${data.changedCount} 处变化，本报告保留生成时的内容，可生成新版本。`} />}
    {data?.sourceStatus === 'current' && <Alert type="success" message="报告依据与当前日记一致" />}
    {data?.data?.length > 0 && <List header="AI 建议（确认后才会创建待办）" dataSource={data.data} renderItem={item => <List.Item actions={item.status === 'pending' ? [
      <Button key="accept" size="small" disabled={busy} onClick={() => { setEditing(item); form.setFieldsValue({ content: item.content, priority: item.priority, dueDate: null }); }}>编辑并确认</Button>,
      <Button key="dismiss" size="small" disabled={busy} onClick={() => act(item, 'dismiss')}>忽略</Button>
    ] : []}>
      <Space><Tag>{({ pending: '待确认', accepted: '已确认', dismissed: '已忽略' })[item.status]}</Tag><span>{item.content}</span></Space>
    </List.Item>} />}
    <Modal title="确认待办" open={!!editing} onCancel={() => { if (!busy) setEditing(null); }} confirmLoading={busy} onOk={() => form.submit()} okText="确认创建">
      <Form form={form} layout="vertical" onFinish={v => act(editing, 'accept', { ...v, dueDate: v.dueDate.toISOString() })}>
        <Form.Item name="content" label="待办内容" rules={[{ required: true, whitespace: true }, { max: 2000 }]}><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="priority" label="优先级" rules={[{ required: true }]}><Select options={['高', '中', '低'].map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="dueDate" label="截止日期" rules={[{ required: true, message: '请自行确认截止日期' }]}><DatePicker showTime /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
