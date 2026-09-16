import React, { useState, useEffect, useRef } from 'react';
import { List, Card, Button, Space, Tag, Modal, Form, Input, message, Typography, Tabs, DatePicker, Select, Pagination, Alert } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import PageHeading from './PageHeading';

const { Text } = Typography;
const statuses = ['待办', '已完成', '已放弃', '已转交'];
const TodoList = () => {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('待办');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [todos, setTodos] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(undefined);
  const [action, setAction] = useState(null);
  const [revision, setRevision] = useState(0);
  const [form] = Form.useForm();
  const [actionForm] = Form.useForm();
  const requestId = useRef(0);
  const saveLock = useRef(false);
  const refresh = () => { setRevision(v => v + 1); window.dispatchEvent(new CustomEvent('todosUpdated')); };

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    Promise.all([
      api.get('/todos', { params: { status, search, page, limit: 20 } }),
      api.get('/todos/stats')
    ]).then(([list, stats]) => {
      if (id !== requestId.current) return;
      setTodos(list.data.todos); setTotal(list.data.pagination.total);
      const next = Object.fromEntries(stats.data.stats.statusStats.map(s => [s._id, s.count]));
      setCounts(next);
      window.dispatchEvent(new CustomEvent('todosCountUpdated', { detail: next['待办'] || 0 }));
    }).catch(() => { if (id === requestId.current) message.error('获取待办失败，请重试'); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
    return () => { requestId.current++; };
  }, [status, search, page, revision]);

  const openEditor = (todo = null) => {
    form.resetFields();
    form.setFieldsValue(todo ? { ...todo, dueDate: dayjs(todo.dueDate) } : { priority: '中', dueDate: dayjs().add(1, 'day').hour(18).minute(0).second(0) });
    setEditing(todo);
  };
  useEffect(() => {
    if (params.get('new') === '1') { openEditor(); setParams({}, { replace: true }); }
    // The URL action is consumed once; form state remains local thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const saveTodo = async values => {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true);
    try {
      const body = { content: values.content.trim(), priority: values.priority, dueDate: values.dueDate.toISOString() };
      if (editing) await api.put(`/todos/${editing._id}`, body);
      else await api.post('/todos', body);
      setEditing(undefined); message.success('待办已保存'); refresh();
    } catch (e) { message.error(e.response?.data?.message || '保存失败，内容已保留'); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const changeStatus = async values => {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true);
    try {
      await api.put(`/todos/${action.todo._id}/status`, { status: action.status, summary: values.summary || '', transferTo: values.transferTo });
      setAction(null); message.success('状态已更新');
      if (todos.length === 1 && page > 1) setPage(page - 1);
      refresh();
    } catch (e) { message.error(e.response?.data?.message || '操作失败，请重试'); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const dueLabel = todo => {
    const due = dayjs(todo.dueDate);
    if (todo.status !== '待办') return due.format('YYYY-MM-DD HH:mm');
    return `${due.isBefore(dayjs()) ? '已逾期 · ' : due.isSame(dayjs(), 'day') ? '今天到期 · ' : ''}${due.format('YYYY-MM-DD HH:mm')}`;
  };
  return <div className="task-list">
    <PageHeading eyebrow="NEXT ACTIONS" title="待办事项" description="把下一步写清楚，一件一件完成。" actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新增待办</Button>} />
    <Card>
      <Input.Search allowClear placeholder="搜索待办内容" onSearch={value => { setSearch(value); setPage(1); }} style={{ maxWidth: 360, marginBottom: 16 }} />
      <Tabs activeKey={status} onChange={value => { setStatus(value); setPage(1); }} items={statuses.map(s => ({ key: s, label: `${s === '待办' ? '待处理' : s} (${counts[s] || 0})` }))} />
      {status === '待办' && <Text type="secondary">按截止时间排序，逾期和最早到期的任务优先显示。</Text>}
      <List loading={loading} dataSource={todos} locale={{ emptyText: search ? '没有匹配的待办，试试其他关键词' : '暂无待办，可点击“新增待办”' }} renderItem={todo => <List.Item key={todo._id}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong style={{ whiteSpace: 'pre-wrap' }}>{todo.content}</Text>
          <Space wrap><Tag>{todo.priority}优先级</Tag><Text type={todo.status === '待办' && dayjs(todo.dueDate).isBefore(dayjs()) ? 'danger' : 'secondary'}>{dueLabel(todo)}</Text>
            {todo.relatedDiary && <Link to={`/app/diaries/${todo.relatedDiary._id}/edit`}>查看来源日记</Link>}
          </Space>
          {todo.statusHistory?.length > 0 && <Text type="secondary">最近处理：{todo.statusHistory[todo.statusHistory.length - 1].reason || '已更新状态'}</Text>}
          <Space wrap className="task-actions">
            <Button icon={<EditOutlined />} onClick={() => openEditor(todo)}>编辑 / 延期</Button>
            {(todo.status === '待办' ? ['已完成', '已放弃', '已转交'] : ['待办']).map(next => <Button type={next === '已完成' ? 'primary' : 'default'} key={next} onClick={() => { actionForm.resetFields(); setAction({ todo, status: next }); }}>{next === '待办' ? '重新打开' : next === '已完成' ? '完成' : next.slice(1)}</Button>)}
          </Space>
        </Space>
      </List.Item>} />
      <Pagination current={page} pageSize={20} total={total} onChange={setPage} showSizeChanger={false} hideOnSinglePage />
    </Card>
    <Modal title={editing ? '编辑待办 / 调整截止时间' : '新增待办'} open={editing !== undefined} onCancel={() => !saving && setEditing(undefined)} onOk={() => form.submit()} confirmLoading={saving} maskClosable={!saving}>
      <Form form={form} layout="vertical" onFinish={saveTodo}>
        <Form.Item name="content" label="后续行动" rules={[{ required: true, whitespace: true, message: '请输入待办内容' }]}><Input.TextArea rows={4} maxLength={5000} /></Form.Item>
        <Form.Item name="dueDate" label="截止日期和时间" rules={[{ required: true, message: '请选择截止时间' }]}><DatePicker showTime format="YYYY-MM-DD HH:mm" /></Form.Item>
        <Form.Item name="priority" label="优先级" rules={[{ required: true }]}><Select options={['高', '中', '低'].map(value => ({ value, label: value }))} /></Form.Item>
        {editing?.relatedDiary && <Alert type="info" message="这里只修改待办，不会覆盖来源日记。" />}
      </Form>
    </Modal>
    <Modal title={action?.status === '待办' ? '重新打开待办' : `确认${action?.status || ''}`} open={!!action} onCancel={() => !saving && setAction(null)} onOk={() => actionForm.submit()} confirmLoading={saving} maskClosable={!saving}>
      <p>{action?.todo.content}</p>
      <Form form={actionForm} layout="vertical" onFinish={changeStatus}>
        {action?.status === '已转交' && <Form.Item name="transferTo" label="转交给谁（仅记录，不自动通知）" rules={[{ required: true, whitespace: true }]}><Input /></Form.Item>}
        <Form.Item name="summary" label="处理说明（可选）"><Input.TextArea rows={3} maxLength={500} /></Form.Item>
      </Form>
    </Modal>
  </div>;
};
export default TodoList;
