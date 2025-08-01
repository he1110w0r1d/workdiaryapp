import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Switch, Button, InputNumber, Select, message, Divider, Typography, Space, Radio } from 'antd';
import { SettingOutlined, SaveOutlined, SyncOutlined, CloudOutlined, DesktopOutlined } from '@ant-design/icons';
import api from '../utils/api';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  // 根据外部提供商获取模型名称占位符
  const getModelPlaceholder = (provider) => {
    const placeholders = {
      openai: '例如: gpt-3.5-turbo, gpt-4, gpt-4-turbo',
      claude: '例如: claude-3-sonnet-20240229, claude-3-haiku-20240307',
      qianwen: '例如: qwen-turbo, qwen-plus, qwen-max',
      custom: '输入自定义模型名称'
    };
    return placeholders[provider] || '输入模型名称';
  };

  // 获取当前设置
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await api.get('/settings/llm');
        setSettings(response.data);
        form.setFieldsValue(response.data);
      } catch (error) {
        console.error('获取设置失败:', error);
        message.error('获取设置失败，使用默认配置');
        // 设置默认值
        const defaultSettings = {
          llmType: 'local',
          useLocalLLM: false,
          apiUrl: 'http://localhost:11434/api/generate',
          model: 'llama3',
          timeout: 60000,
          temperature: 0.7,
          // 外部LLM设置
          externalProvider: 'openai',
          externalApiKey: '',
          externalApiUrl: '',
          externalModel: 'gpt-3.5-turbo',
          externalTimeout: 30000,
          externalTemperature: 0.7,
          externalMaxTokens: 2000
        };
        setSettings(defaultSettings);
        form.setFieldsValue(defaultSettings);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [form]);

  // 保存设置
  const handleSave = async (values) => {
    try {
      setLoading(true);
      // 合并当前表单值和已保存的设置，确保所有配置都被保留
      const mergedValues = {
        ...settings, // 保留现有设置
        ...values    // 覆盖当前表单值
      };
      await api.post('/settings/llm', mergedValues);
      message.success('设置保存成功');
      setSettings(mergedValues);
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试LLM连接
  const handleTestConnection = async () => {
    try {
      setTestLoading(true);
      const values = form.getFieldsValue();
      const response = await api.post('/settings/llm/test', values);
      if (response.data.success) {
        message.success('连接测试成功: ' + response.data.message);
      } else {
        message.error('连接测试失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      message.error('测试连接失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <SettingOutlined /> LLM设置
        </Space>
      }
      loading={loading && !settings}
    >
      <Typography>
        <Paragraph>
          配置大语言模型(LLM)以增强工作总结生成功能。支持本地部署的LLM和外部API服务，系统将使用LLM生成更智能、更个性化的工作总结。
        </Paragraph>
      </Typography>

      <Divider />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={settings || {}}
      >
        <Form.Item
          name="llmType"
          label="LLM类型"
          rules={[{ required: true, message: '请选择LLM类型' }]}
        >
          <Radio.Group>
            <Radio.Button value="local">
              <Space>
                <DesktopOutlined /> 本地LLM
              </Space>
            </Radio.Button>
            <Radio.Button value="external">
              <Space>
                <CloudOutlined /> 外部LLM
              </Space>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* 隐藏字段用于保存所有配置数据 */}
        <Form.Item name="useLocalLLM" hidden>
          <Switch />
        </Form.Item>
        <Form.Item name="apiUrl" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="model" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="customModel" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="timeout" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="temperature" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="externalProvider" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="externalApiKey" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="externalApiUrl" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="externalModel" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="externalTimeout" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="externalTemperature" hidden>
          <InputNumber />
        </Form.Item>
        <Form.Item name="externalMaxTokens" hidden>
          <InputNumber />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.llmType !== currentValues.llmType}
        >
          {({ getFieldValue }) => {
            const llmType = getFieldValue('llmType');
            
            if (llmType === 'local') {
              return (
                <>                  <Form.Item
                    name="useLocalLLM"
                    label="启用本地LLM"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </>
              );
            }
            
            return null;
          }}
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => 
            prevValues.llmType !== currentValues.llmType || 
            prevValues.externalProvider !== currentValues.externalProvider ||
            prevValues.model !== currentValues.model
          }
        >
          {() => {
            const llmType = form.getFieldValue('llmType');
            const externalProvider = form.getFieldValue('externalProvider');
            const model = form.getFieldValue('model');
            
            if (llmType === 'local') {
              return (
                <>
                  <Divider orientation="left">本地LLM配置</Divider>
                  
                  <Form.Item
                    name="apiUrl"
                    label="API地址"
                    rules={[{ required: true, message: '请输入API地址' }]}
                  >
                    <Input 
                      placeholder="例如: http://localhost:11434/api/generate" 
                    />
                  </Form.Item>

                  <Form.Item
                    name="model"
                    label="模型名称"
                    rules={[{ required: true, message: '请输入模型名称' }]}
                  >
                    <Select 
                      placeholder="选择模型"
                    >
                      <Option value="llama3">Llama 3</Option>
                      <Option value="llama2">Llama 2</Option>
                      <Option value="mistral">Mistral</Option>
                      <Option value="qwen">Qwen</Option>
                      <Option value="baichuan2">Baichuan 2</Option>
                      <Option value="chatglm3">ChatGLM 3</Option>
                      <Option value="custom">自定义</Option>
                    </Select>
                  </Form.Item>

                  {model === 'custom' && (
                    <Form.Item
                      name="customModel"
                      label="自定义模型名称"
                      rules={[{ required: true, message: '请输入自定义模型名称' }]}
                    >
                      <Input 
                          placeholder="输入自定义模型名称" 
                        />
                    </Form.Item>
                  )}

                  <Form.Item
                    name="timeout"
                    label="请求超时时间(毫秒)"
                    rules={[{ required: true, message: '请输入超时时间' }]}
                  >
                    <InputNumber 
                      min={1000} 
                      max={600000} 
                      step={1000} 
                      style={{ width: '100%' }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="temperature"
                    label="温度参数"
                    tooltip="控制输出的随机性，值越高随机性越大，值越低则更确定性"
                    rules={[{ required: true, message: '请输入温度参数' }]}
                  >
                    <InputNumber 
                      min={0} 
                      max={2} 
                      step={0.1} 
                      style={{ width: '100%' }} 
                    />
                  </Form.Item>
                </>
              );
            } else if (llmType === 'external') {
              return (
                <>
                  <Divider orientation="left">外部LLM配置</Divider>
                  
                  <Form.Item
                    name="externalProvider"
                    label="外部提供商"
                    rules={[{ required: true, message: '请选择外部提供商' }]}
                  >
                    <Select 
                      placeholder="选择外部LLM提供商"
                    >
                      <Option value="openai">OpenAI</Option>
                      <Option value="claude">Claude (Anthropic)</Option>
                      <Option value="qianwen">千问 (阿里云)</Option>
                      <Option value="custom">自定义API</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="externalApiKey"
                    label="API密钥"
                    rules={[{ required: true, message: '请输入API密钥' }]}
                  >
                    <Input.Password 
                      placeholder="输入API密钥" 
                    />
                  </Form.Item>

                  {externalProvider === 'custom' && (
                    <Form.Item
                      name="externalApiUrl"
                      label="自定义API地址"
                      rules={[{ required: true, message: '请输入API地址' }]}
                    >
                      <Input 
                          placeholder="例如: https://api.example.com/v1/chat/completions" 
                        />
                    </Form.Item>
                  )}

                  <Form.Item
                    name="externalModel"
                    label="模型名称"
                    rules={[{ required: true, message: '请输入模型名称' }]}
                  >
                    <Input 
                      placeholder={getModelPlaceholder(form.getFieldValue('externalProvider'))} 
                    />
                  </Form.Item>

                  <Form.Item
                    name="externalTimeout"
                    label="请求超时时间(毫秒)"
                    rules={[{ required: true, message: '请输入超时时间' }]}
                  >
                    <InputNumber 
                      min={1000} 
                      max={600000} 
                      step={1000} 
                      style={{ width: '100%' }} 
                    />
                  </Form.Item>

                  <Form.Item
                    name="externalTemperature"
                    label="温度参数"
                    tooltip="控制输出的随机性，值越高随机性越大，值越低则更确定性"
                    rules={[{ required: true, message: '请输入温度参数' }]}
                  >
                    <InputNumber 
                      min={0} 
                      max={2} 
                      step={0.1} 
                      style={{ width: '100%' }} 
                    />
                  </Form.Item>

                  <Form.Item
                    name="externalMaxTokens"
                    label="最大Token数"
                    tooltip="生成内容的最大长度限制"
                    rules={[{ required: true, message: '请输入最大Token数' }]}
                  >
                    <InputNumber 
                      min={100} 
                      max={8000} 
                      step={100} 
                      style={{ width: '100%' }} 
                    />
                  </Form.Item>
                </>
              );
            }
            
            return null;
          }}
        </Form.Item>

        <Form.Item>
          <Space>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<SaveOutlined />}
            >
              保存设置
            </Button>
            <Button 
              onClick={handleTestConnection} 
              loading={testLoading}
              icon={<SyncOutlined />}
            >
              测试连接
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default Settings;