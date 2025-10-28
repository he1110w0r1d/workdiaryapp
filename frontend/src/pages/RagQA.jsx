import React, { useState } from 'react';
import { Button, Input, Typography, Card, Space, message } from 'antd';
import api from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Link } from 'react-router-dom';

const { Text, Paragraph } = Typography;

export default function RagQA() {
  const [question, setQuestion] = useState('');
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [answer, setAnswer] = useState('');
  const [snippets, setSnippets] = useState([]);

  const formatDate = (iso) => {
    if (!iso) return '未知日期';
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const formatTimeRange = (start, end) => {
    if (!start || !end) return '';
    const s = new Date(start);
    const e = new Date(end);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(s.getHours())}:${pad(s.getMinutes())} - ${pad(e.getHours())}:${pad(e.getMinutes())}`;
  };

  const handleReindex = async () => {
    setLoadingIndex(true);
    try {
      // 将重建索引改为“整篇日记作为一个切片”模式
      const resp = await api.post('/rag/reindex?strategy=perDiary');
      if (resp.data?.success) {
        message.success(`已重建索引：日记${resp.data.indexedDiaries}，片段${resp.data.indexedChunks}（策略：${resp.data.strategy}）`);
      } else {
        message.error(resp.data?.message || '重建索引失败');
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e.message || '重建索引异常');
    } finally {
      setLoadingIndex(false);
    }
  };

  const handleQuery = async () => {
    const q = question.trim();
    if (!q) return message.warning('请输入你的问题');
    setLoadingQuery(true);
    setAnswer('');
    setSnippets([]);
    try {
      const resp = await api.post('/rag/query', { question: q, topK: 10 });
      if (resp.data?.success) {
        setAnswer(resp.data.answer || '');
        setSnippets(resp.data.snippets || []);
      } else {
        message.error(resp.data?.message || '查询失败');
      }
    } catch (e) {
      message.error(e?.response?.data?.message || e.message || '查询异常');
    } finally {
      setLoadingQuery(false);
    }
  };

  // 根据命中片段生成唯一的参考日记列表（按日期升序）
  const referenceDiaries = Object.values(
    snippets.reduce((acc, s) => {
      const id = s.diary;
      if (!acc[id]) {
        acc[id] = { diary: id, startTime: s.startTime, endTime: s.endTime };
      } else {
        const prev = acc[id];
        if (s.startTime && prev.startTime && new Date(s.startTime) < new Date(prev.startTime)) {
          prev.startTime = s.startTime;
        }
        if (s.endTime && prev.endTime && new Date(s.endTime) > new Date(prev.endTime)) {
          prev.endTime = s.endTime;
        }
      }
      return acc;
    }, {})
  ).sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* 移除原“RAG知识库问答”卡片 */}
      {/* <Card title="RAG知识库问答">
        <Space>
          <Button type="primary" onClick={handleReindex} loading={loadingIndex}>重建索引</Button>
        </Space>
      </Card> */}

      <Card title="提问">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea rows={4} value={question} onChange={e => setQuestion(e.target.value)} placeholder="输入你的问题，例如：今年我在哪些项目上投入最多？" />
          <Space>
            <Button type="primary" onClick={handleQuery} loading={loadingQuery}>查询</Button>
            <Button onClick={handleReindex} loading={loadingIndex}>重建索引</Button>
          </Space>
        </Space>
      </Card>

      <Card title="答案">
        {answer ? (
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            <ReactMarkdown
              children={answer}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
            />
            {referenceDiaries.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
                <div style={{ fontWeight: 'bold' }}>参考日记日期列表</div>
                <ul style={{ paddingLeft: '18px', marginTop: 8 }}>
                  {referenceDiaries.map(d => (
                    <li key={d.diary}>
                      <Link to={`/app/diaries/${d.diary}/edit`}>
                        {formatDate(d.startTime)} {formatTimeRange(d.startTime, d.endTime)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <Paragraph style={{ whiteSpace: 'pre-wrap' }}>（暂无）</Paragraph>
        )}
      </Card>

      {/* 移除“命中片段”展示卡片 */}
      {/* <Card title="命中片段">
        <List
          dataSource={snippets}
          renderItem={(item, idx) => (
            <List.Item>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">片段{idx + 1}（score={item.score?.toFixed?.(3)}）</Text>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{item.text}</Paragraph>
              </Space>
            </List.Item>
          )}
        />
      </Card> */}
    </Space>
  );
}