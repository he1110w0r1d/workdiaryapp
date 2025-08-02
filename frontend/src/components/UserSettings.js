import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Avatar, Upload, message, Divider, Typography, Space, Spin, Select, Row, Col } from 'antd';
import { UserOutlined, SaveOutlined, UploadOutlined, LogoutOutlined, ToolOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const { Title, Text } = Typography;

const UserSettings = () => {
  const [form] = Form.useForm();
  const [workForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [workLoading, setWorkLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [workProfile, setWorkProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await api.get('/users/profile');
        const userData = response.data;
        setUserInfo(userData);
        form.setFieldsValue({
          username: userData.username,
          email: userData.email,
          nickname: userData.nickname || '',
          bio: userData.bio || ''
        });
        
        // 设置工作信息配置
        const workProfileData = userData.workProfile || {};
        setWorkProfile(workProfileData);
        workForm.setFieldsValue({
          industry: workProfileData.industry || '',
          position: workProfileData.position || '',
          level: workProfileData.level || '',
          department: workProfileData.department || '',
          responsibilities: Array.isArray(workProfileData.responsibilities) 
            ? workProfileData.responsibilities.join('\n') 
            : (workProfileData.responsibilities || ''),
          kpiGoals: workProfileData.kpiGoals || '',
          writingStyle: workProfileData.writingStyle || '',
          summaryPurpose: workProfileData.summaryPurpose || '',
          avoidContent: workProfileData.avoidContent || []
        });
      } catch (error) {
        console.error('获取用户信息失败:', error);
        message.error('获取用户信息失败: ' + (error.response?.data?.message || error.message));
        if (error.response?.status === 401) {
          navigate('/login');
        }
      } finally {
        setPageLoading(false);
      }
    };

    fetchUserProfile();
  }, [form, workForm, navigate]);

  const handleSave = async (values) => {
    setLoading(true);
    try {
      const response = await api.put('/users/profile', values);
      message.success('个人信息保存成功！');
      setUserInfo({ ...userInfo, ...values });
      console.log('用户信息更新成功:', response.data);
    } catch (error) {
      console.error('保存用户设置失败:', error);
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };



  const handleWorkProfileSave = async (values) => {
    setWorkLoading(true);
    
    try {
      // 保存工作信息配置
      const response = await api.put('/users/work-profile', values);
      console.log('工作信息配置更新成功:', response.data);
      
      message.success('工作信息配置保存成功！');
      setWorkProfile({ ...workProfile, ...values });
    } catch (error) {
      console.error('保存工作信息配置失败:', error);
      message.error('保存工作信息配置失败: ' + (error.response?.data?.message || error.message));
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setWorkLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    message.success('已退出登录');
    navigate('/login');
  };

  const handleAvatarUpload = (info) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }
    if (info.file.status === 'done') {
      setLoading(false);
      const response = info.file.response;
      if (response && response.avatar) {
        setUserInfo({ ...userInfo, avatar: response.avatar });
        message.success('头像上传成功');
        // 触发用户信息更新事件，通知Layout组件刷新头像
        window.dispatchEvent(new CustomEvent('userInfoUpdated'));
      }
    } else if (info.file.status === 'error') {
      setLoading(false);
      message.error('头像上传失败: ' + (info.file.response?.message || '未知错误'));
    }
  };

  if (pageLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>加载用户信息中...</div>
      </div>
    );
  }

  // 职级选项
  const levels = [
    { value: 'junior', label: '初级（1-3年）' },
    { value: 'middle', label: '中级（3-5年）' },
    { value: 'senior', label: '高级（5-8年）' },
    { value: 'expert', label: '专家级（8年以上）' },
    { value: 'manager', label: '管理层' }
  ];

  // 写作风格选项
  const writingStyles = [
    { value: 'concise', label: '简洁明了' },
    { value: 'reflective', label: '深度反思' },
    { value: 'data_driven', label: '数据驱动' },
    { value: 'narrative', label: '叙述性' }
  ];

  // 总结用途选项
  const summaryPurposes = [
    { value: 'report_up', label: '向上汇报' },
    { value: 'annual_review', label: '年度评估' },
    { value: 'self_reflection', label: '自我反思' },
    { value: 'team_sharing', label: '团队分享' },
    { value: 'promotion', label: '晋升材料' }
  ];

  // 避免内容选项
  const avoidContentOptions = [
    { value: 'empty_words', label: '空洞套话' },
    { value: 'exaggeration', label: '过度美化/夸大' },
    { value: 'technical_inaccuracy', label: '与实际不符的技术细节' },
    { value: 'emotional_expression', label: '泛泛而谈的情绪表达' }
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <UserOutlined /> 个人信息设置
          </Space>
        }
        loading={!userInfo}
        style={{ marginBottom: 24 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar 
            size={80} 
            src={userInfo?.avatar ? `${process.env.REACT_APP_API_URL.replace('/api', '')}${userInfo.avatar}` : undefined}
            icon={!userInfo?.avatar ? <UserOutlined /> : undefined}
            style={{ 
              background: userInfo?.avatar ? 'transparent' : 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: '#333',
              border: '3px solid #f0f0f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          />
          <div style={{ marginTop: 12 }}>
            <Upload
              name="avatar"
              action={`${process.env.REACT_APP_API_URL}/users/upload-avatar`}
              headers={{
                authorization: `Bearer ${localStorage.getItem('token')}`,
              }}
              showUploadList={false}
              onChange={handleAvatarUpload}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />} size="small">
                更换头像
              </Button>
            </Upload>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={userInfo}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="邮箱地址" />
          </Form.Item>

          <Form.Item
            name="nickname"
            label="昵称"
          >
            <Input placeholder="昵称（可选）" />
          </Form.Item>

          <Form.Item
            name="bio"
            label="个人简介"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="简单介绍一下自己..." 
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Divider />

          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<SaveOutlined />}
            >
              保存设置
            </Button>
            
            <Button 
              danger 
              onClick={handleLogout}
              icon={<LogoutOutlined />}
            >
              退出登录
            </Button>
          </div>
        </Form>

        <Divider />
        
        <div style={{ textAlign: 'center', color: '#666' }}>
          <Text type="secondary">
            注册时间: {userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString() : '未知'}
          </Text>
        </div>
      </Card>

      {/* 工作信息配置卡片 */}
      <Card
        title={
          <Space>
            <ToolOutlined /> 工作信息配置
          </Space>
        }
        loading={!workProfile && !userInfo}
      >
        <Form
          form={workForm}
          layout="vertical"
          onFinish={handleWorkProfileSave}
        >
          <Title level={5}>基本身份信息</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="industry"
                label="所属行业"
              >
                <Input placeholder="如：互联网、金融、制造业" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="position"
                label="职位名称"
              >
                <Input placeholder="如：前端工程师、产品经理" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="level"
                label="职级水平"
              >
                <Select placeholder="请选择您的职级水平">
                  {levels.map(level => (
                    <Select.Option key={level.value} value={level.value}>
                      {level.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="department"
                label="所在团队/部门"
              >
                <Input placeholder="如：技术研发部、市场运营组" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Title level={5}>工作目标导向</Title>
          <Form.Item
            name="responsibilities"
            label="日常主要职责"
          >
            <Input.TextArea
              rows={4}
              placeholder="请列出您的主要职责，如：负责需求调研、协调开发排期、产品测试验收等..."
              maxLength={1000}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="kpiGoals"
            label="关键绩效指标和目标"
          >
            <Input.TextArea
              rows={3}
              placeholder="描述您的主要工作目标和绩效指标..."
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Divider />
          <Title level={5}>偏好设置</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="writingStyle"
                label="工作日志的写作风格偏好"
              >
                <Select placeholder="请选择您希望的总结风格">
                  {writingStyles.map(style => (
                    <Select.Option key={style.value} value={style.value}>
                      {style.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="summaryPurpose"
                label="总结主要用途"
              >
                <Select placeholder="请选择总结的主要用途">
                  {summaryPurposes.map(purpose => (
                    <Select.Option key={purpose.value} value={purpose.value}>
                      {purpose.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="avoidContent"
            label="希望避免的内容类型"
          >
            <Select
              mode="multiple"
              placeholder="选择您希望在总结中避免的内容类型"
              style={{ width: '100%' }}
            >
              {avoidContentOptions.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Divider />
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={workLoading}
              icon={<SaveOutlined />}
              size="large"
            >
              保存工作信息配置
            </Button>

          </div>
        </Form>
      </Card>
    </div>
  );
};

export default UserSettings;