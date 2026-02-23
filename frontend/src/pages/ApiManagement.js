import React, { useState, useEffect } from 'react';
import { Card, Spin, Space, Typography, Tabs } from 'antd';
import { ApiOutlined, BookOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import ApiKeySettings from '../components/ApiKeySettings';
import api from '../utils/api';

const { Title } = Typography;

const ApiManagement = () => {
    const [docContent, setDocContent] = useState('');
    const [docLoading, setDocLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('keys');

    const fetchApiDocs = async () => {
        setDocLoading(true);
        try {
            const response = await api.get('/docs/api-documentation', {
                transformResponse: [(data) => data], // 保持原始文本
            });
            setDocContent(response.data);
        } catch (error) {
            console.error('获取API文档失败:', error);
            setDocContent('> API 文档加载失败，请检查服务器是否正常运行。');
        } finally {
            setDocLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'docs') {
            fetchApiDocs();
        }
    }, [activeTab]);

    const tabItems = [
        {
            key: 'keys',
            label: (
                <Space>
                    <ApiOutlined />
                    API Key 管理
                </Space>
            ),
            children: <ApiKeySettings />,
        },
        {
            key: 'docs',
            label: (
                <Space>
                    <BookOutlined />
                    API 文档
                </Space>
            ),
            children: (
                <Card>
                    {docLoading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <Spin size="large" tip="加载API文档中..." />
                        </div>
                    ) : (
                        <div className="api-doc-content" style={{
                            maxWidth: '900px',
                            lineHeight: '1.8',
                            fontSize: '14px'
                        }}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                    pre: ({ children }) => (
                                        <pre style={{
                                            background: '#f6f8fa',
                                            padding: '16px',
                                            borderRadius: '6px',
                                            overflow: 'auto',
                                            fontSize: '13px',
                                            lineHeight: '1.5',
                                            border: '1px solid #e1e4e8'
                                        }}>
                                            {children}
                                        </pre>
                                    ),
                                    code: ({ inline, children }) => (
                                        inline ? (
                                            <code style={{
                                                background: '#f0f0f0',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                fontSize: '13px',
                                                color: '#c7254e'
                                            }}>
                                                {children}
                                            </code>
                                        ) : (
                                            <code>{children}</code>
                                        )
                                    ),
                                    table: ({ children }) => (
                                        <table style={{
                                            borderCollapse: 'collapse',
                                            width: '100%',
                                            margin: '16px 0'
                                        }}>
                                            {children}
                                        </table>
                                    ),
                                    th: ({ children }) => (
                                        <th style={{
                                            border: '1px solid #dfe2e5',
                                            padding: '8px 12px',
                                            background: '#f6f8fa',
                                            textAlign: 'left',
                                            fontWeight: 600
                                        }}>
                                            {children}
                                        </th>
                                    ),
                                    td: ({ children }) => (
                                        <td style={{
                                            border: '1px solid #dfe2e5',
                                            padding: '8px 12px'
                                        }}>
                                            {children}
                                        </td>
                                    ),
                                    h1: ({ children }) => <h1 style={{ borderBottom: '2px solid #eaecef', paddingBottom: '8px' }}>{children}</h1>,
                                    h2: ({ children }) => <h2 style={{ borderBottom: '1px solid #eaecef', paddingBottom: '6px', marginTop: '32px' }}>{children}</h2>,
                                    h3: ({ children }) => <h3 style={{ marginTop: '24px' }}>{children}</h3>,
                                    hr: () => <hr style={{ border: 'none', borderTop: '1px solid #eaecef', margin: '24px 0' }} />,
                                    blockquote: ({ children }) => (
                                        <blockquote style={{
                                            borderLeft: '4px solid #dfe2e5',
                                            padding: '8px 16px',
                                            margin: '16px 0',
                                            color: '#6a737d',
                                            background: '#f8f9fa'
                                        }}>
                                            {children}
                                        </blockquote>
                                    ),
                                }}
                            >
                                {docContent}
                            </ReactMarkdown>
                        </div>
                    )}
                </Card>
            ),
        },
    ];

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                type="card"
                size="large"
            />
        </div>
    );
};

export default ApiManagement;
