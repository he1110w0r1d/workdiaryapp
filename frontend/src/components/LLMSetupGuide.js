import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Space, Steps, message, InputNumber, Alert } from 'antd';
import { CloudOutlined, CheckOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const { Title, Paragraph, Text, Link } = Typography;
const { Step } = Steps;

const LLMSetupGuide = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  // 默认的硅基流动配置
  const defaultConfig = {
    llmType: 'external',
    externalProvider: 'custom', // 硅基流动作为自定义API
    externalApiKey: '',
    externalApiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    externalModel: 'deepseek-ai/DeepSeek-V3',
    externalTimeout: 600000,
    externalTemperature: 0.7,
    externalMaxTokens: 8000
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // 构建用户个人LLM配置
      const userLLMConfig = {
        name: '硅基流动 (默认)',
        provider: 'custom',
        apiKey: values.externalApiKey,
        apiUrl: defaultConfig.externalApiUrl,
        model: defaultConfig.externalModel,
        timeout: defaultConfig.externalTimeout,
        temperature: defaultConfig.externalTemperature,
        maxTokens: defaultConfig.externalMaxTokens,
        isDefault: true,
        isActive: true
      };

      // 保存到用户个人LLM配置
      await api.post('/settings/user-llm', userLLMConfig);
      message.success('AI助手配置保存成功！');
      
      // 跳转到主页面
      navigate('/app');
    } catch (error) {
      message.error(error.response?.data?.message || 'AI助手配置保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/app');
  };

  const steps = [
    {
      title: '欢迎使用',
      content: (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>
          <Title level={2}>欢迎使用工作日记系统！</Title>
          <Paragraph style={{ fontSize: '16px', marginBottom: '32px' }}>
            为了获得更好的体验，我们建议您配置AI助手功能。
            <br />
            AI助手可以帮您自动生成工作总结，提升工作效率。
          </Paragraph>
          <Space size="large">
            <Button size="large" onClick={() => setCurrentStep(1)}>
              开始配置 <RightOutlined />
            </Button>
            <Button size="large" type="link" onClick={handleSkip}>
              暂时跳过
            </Button>
          </Space>
        </div>
      )
    },
    {
      title: '配置AI助手',
      content: (
        <div>
          <Alert
            message="推荐使用硅基流动API"
            description="硅基流动提供高性价比的AI服务，支持多种先进模型，适合个人和企业使用。"
            type="info"
            showIcon
            style={{ marginBottom: '24px' }}
          />
          
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={defaultConfig}
          >
            <Form.Item label="服务提供商">
              <Input value="硅基流动 (SiliconFlow)" disabled />
            </Form.Item>

            <Form.Item label="API地址">
              <Input value={defaultConfig.externalApiUrl} disabled />
            </Form.Item>

            <Form.Item label="模型名称">
              <Input value={defaultConfig.externalModel} disabled />
            </Form.Item>

            <Form.Item
              name="externalApiKey"
              label="API密钥"
              rules={[{ required: true, message: '请输入API密钥' }]}
              extra={
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary">还没有API密钥？</Text>
                  <Link 
                    href="https://cloud.siliconflow.cn/i/TTiemPwh" 
                    target="_blank"
                    style={{ marginLeft: '8px' }}
                  >
                    点击注册获取 →
                  </Link>
                </div>
              }
            >
              <Input.Password 
                placeholder="请输入您的硅基流动API密钥" 
                size="large"
              />
            </Form.Item>

            <div style={{ 
              background: '#f8f9fa', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <Title level={5} style={{ marginBottom: '12px' }}>📋 默认配置参数</Title>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div><Text strong>请求超时时间：</Text>{defaultConfig.externalTimeout / 1000}秒</div>
                <div><Text strong>温度参数：</Text>{defaultConfig.externalTemperature}</div>
                <div><Text strong>最大Token数：</Text>{defaultConfig.externalMaxTokens}</div>
              </Space>
              <Paragraph type="secondary" style={{ marginTop: '12px', marginBottom: 0 }}>
                这些参数已为您优化配置，后续可在系统设置中调整。
              </Paragraph>
            </div>

            <Form.Item>
              <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  size="large"
                  icon={<CheckOutlined />}
                >
                  完成配置
                </Button>
                <Button size="large" onClick={handleSkip}>
                  暂时跳过
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      )
    }
  ];

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card 
        style={{ 
          width: '100%',
          maxWidth: '800px',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}
      >
        <Steps current={currentStep} style={{ marginBottom: '32px' }}>
          {steps.map((step, index) => (
            <Step key={index} title={step.title} />
          ))}
        </Steps>
        
        <div style={{ minHeight: '400px' }}>
          {steps[currentStep].content}
        </div>
      </Card>
    </div>
  );
};

export default LLMSetupGuide;
