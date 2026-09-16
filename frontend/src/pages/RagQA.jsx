import React, { useState, useRef } from 'react';
import { Button, Input, Card, Space, message, Alert } from 'antd';
import { ArrowRightOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import dayjs from 'dayjs';
import api from '../utils/api';
import BackgroundJobs from '../components/BackgroundJobs';
import PageHeading from '../components/PageHeading';
export default function RagQA() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [answer, setAnswer] = useState('');
  const [asked, setAsked] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [error, setError] = useState('');
  const queryLock = useRef(false);
  const query = async () => {
    if (queryLock.current || !question.trim()) return;
    queryLock.current = true; setLoading(true); setError(''); setAnswer(''); setSnippets([]); setAsked(question.trim());
    try {
      const { data } = await api.post('/rag/query', { question: question.trim(), topK: 10 });
      if (!data.success) throw new Error(data.message || '查询未完成');
      setAnswer(data.answer || '没有找到足够的记录来回答这个问题。'); setSnippets(data.snippets || []);
    } catch (e) { setError(e.response?.data?.message || e.message || '暂时无法回答，请稍后重试。'); }
    finally { queryLock.current = false; setLoading(false); }
  };
  const reindex = async () => {
    setIndexing(true);
    try { const { data } = await api.post('/rag/reindex?strategy=perDiary'); if (data.success) message.success(data.message); else message.error(data.message || '同步未能开始'); }
    catch (e) { message.error(e.response?.data?.message || '同步未能开始'); }
    finally { setIndexing(false); }
  };
  const sources = [...new Map(snippets.filter(s => s.diary).map(s => [s.diary, s])).values()];
  return <div className="rag-page">
    <PageHeading eyebrow="ASK YOUR WORK" title="问问你的工作记录" description="从已保存的日记中找线索，回答附带来源，方便回看。" />
    <Card><Input.TextArea className="question-input" aria-label="你的问题" value={question} onChange={e => setQuestion(e.target.value)} autoSize={{ minRows: 4, maxRows: 10 }} placeholder="例如：最近一次项目沟通，确定了哪些后续工作？" maxLength={5000} />
      <div className="capture-footer"><span>回答基于检索到的记录，请结合来源核对。</span><Button type="primary" disabled={!question.trim()} loading={loading} icon={<ArrowRightOutlined />} onClick={query}>查找答案</Button></div>
    </Card>
    {error && <Alert style={{ marginTop: 20 }} showIcon type="error" message={error} action={<Button onClick={query}>重试</Button>} />}
    <Card title={asked ? '关于你的问题' : '让过去的记录，回答现在的问题'} style={{ marginTop: 24 }} loading={loading}>
      {answer ? <div className="answer-body"><p className="muted">{asked}</p><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{answer}</ReactMarkdown>
        {sources.length > 0 && <div className="answer-sources"><h3>参考记录 · {sources.length}</h3><Space wrap>{sources.map(s => <Link className="source-link" key={s.diary} to={`/app/diaries/${s.diary}/edit`}>{dayjs(s.startTime).format('YYYY-MM-DD HH:mm')} <ArrowRightOutlined /></Link>)}</Space></div>}
      </div> : <div className="rag-empty"><SearchOutlined style={{ fontSize: 23 }} /><p>可以问某个项目的进展，也可以回顾一段时间的工作。</p><Space wrap>{['最近有哪些需要跟进的工作？', '上周的主要工作是什么？'].map(q => <Button key={q} type="dashed" onClick={() => setQuestion(q)}>{q}</Button>)}</Space></div>}
    </Card>
    <details className="rag-maintenance"><summary>检索维护与同步状态</summary><p className="muted">日记保存后会自动同步。仅在需要修复检索时手动重建。</p><Button loading={indexing} onClick={reindex}>重建检索索引</Button><BackgroundJobs kind="index" /></details>
  </div>;
}
