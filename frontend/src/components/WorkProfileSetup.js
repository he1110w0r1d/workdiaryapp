import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Steps,
  Card,
  Row,
  Col,
  Checkbox,
  message,
  Typography,
  Alert
} from 'antd';
import { UserOutlined, BulbOutlined, FileTextOutlined, CheckOutlined, LinkOutlined } from '@ant-design/icons';
import api from '../utils/api';
import Logger from '../utils/logger';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

const WorkProfileSetup = ({ visible, onClose, onComplete }) => {
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [workProfile, setWorkProfile] = useState({});





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
    { value: 'concise', label: '简洁精炼型（适合汇报）' },
    { value: 'reflective', label: '反思成长型（适合自我复盘）' },
    { value: 'data_driven', label: '数据驱动型（强调量化成果）' },
    { value: 'narrative', label: '故事叙述型（突出挑战与解决过程）' }
  ];

  // 总结用途选项
  const summaryPurposes = [
    { value: 'report_up', label: '向上级汇报' },
    { value: 'annual_review', label: '年终述职' },
    { value: 'self_reflection', label: '自我复盘' },
    { value: 'team_sharing', label: '团队共享' },
    { value: 'promotion', label: '晋升材料' }
  ];

  // 希望避免的内容选项
  const avoidContents = [
    { value: 'empty_words', label: '空话套话（如"努力工作""积极沟通"）' },
    { value: 'exaggeration', label: '过度美化/夸大' },
    { value: 'technical_inaccuracy', label: '与实际不符的技术细节' },
    { value: 'emotional_expression', label: '泛泛而谈的情绪表达' }
  ];

  const steps = [
    {
      title: '基本信息',
      icon: <UserOutlined />,
      description: '填写您的工作背景'
    },
    {
      title: '工作目标',
      icon: <BulbOutlined />,
      description: '描述您的职责和目标'
    },
    {
      title: '偏好设置',
      icon: <FileTextOutlined />,
      description: '设置写作风格和用途'
    },
    {
      title: '完成设置',
      icon: <CheckOutlined />,
      description: '保存工作信息配置'
    }
  ];

  const next = () => {
    form.validateFields().then(values => {
      setWorkProfile(prev => ({ ...prev, ...values }));
      setCurrent(current + 1);
    }).catch(info => {
      Logger.debug('表单验证失败:', info);
    });
  };

  const prev = () => {
    setCurrent(current - 1);
  };



  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const finalProfile = { ...workProfile, ...values };
      
      Logger.user('准备提交工作信息:', finalProfile);
      
      setLoading(true);
      
      // 保存工作信息配置
      const response = await api.put('/users/work-profile', finalProfile);
      Logger.user('工作信息保存成功:', response.data);
      
      message.success('工作信息配置保存成功！');
      
      // 关闭模态框
      setTimeout(() => {
        onComplete && onComplete();
        onClose();
      }, 1000);
      
    } catch (error) {
      Logger.error('保存工作信息失败:', error);
      message.error(`保存失败：${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <Card title="基本身份信息" className="step-card">
            <Alert
              message="💡 提示：如需使用AI功能，请先获取SiliconFlow API密钥"
              description={
                <div>
                  <span>本应用支持AI智能总结功能，需要配置SiliconFlow API密钥。</span>
                  <Button 
                    type="link" 
                    icon={<LinkOutlined />}
                    onClick={() => window.open('/siliconflowregiest/index.html', '_blank')}
                    style={{ padding: 0, marginLeft: 8 }}
                  >
                    查看API注册教程
                  </Button>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="industry"
                  label="所属行业"
                  rules={[{ required: true, message: '请输入您的行业' }]}
                >
                  <Input placeholder="请输入您所在的行业，如：互联网/软件、金融/银行、教育/培训等" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="position"
                  label="岗位名称"
                  rules={[{ required: true, message: '请输入您的岗位名称' }]}
                >
                  <Input placeholder="如：产品经理、前端开发、项目经理" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="level"
                  label="职级/经验年限"
                  rules={[{ required: true, message: '请选择您的职级' }]}
                >
                  <Select placeholder="请选择职级">
                    {levels.map(level => (
                      <Option key={level.value} value={level.value}>{level.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="department"
                  label="所在团队/部门"
                  rules={[{ required: true, message: '请输入您的部门' }]}
                >
                  <Input placeholder="如：技术研发部、市场运营组" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        );
      
      case 1:
        return (
          <Card title="工作目标导向" className="step-card">
            <Form.Item
              name="responsibilities"
              label="日常主要职责"
              rules={[{ required: true, message: '请描述您的主要职责' }]}
              extra="请列出3-5条具体职责，每行一条"
            >
              <TextArea
                rows={6}
                placeholder={`示例：\n负责需求调研、撰写PRD文档\n协调前后端开发排期\n产品功能测试和验收\n用户反馈收集和分析\n竞品分析和市场调研`}
              />
            </Form.Item>
            <Form.Item
              name="kpiGoals"
              label="关键绩效指标（KPI）或OKR重点方向"
              rules={[{ required: true, message: '请描述您的关键目标' }]}
              extra="描述您当前的主要工作目标和考核指标"
            >
              <TextArea
                rows={4}
                placeholder="示例：Q4目标：提升用户留存率5%、完成3个核心功能迭代、用户满意度达到90%以上"
              />
            </Form.Item>
          </Card>
        );
      
      case 2:
        return (
          <Card title="偏好设置" className="step-card">
            <Form.Item
              name="writingStyle"
              label="工作日志的写作风格偏好"
              rules={[{ required: true, message: '请选择写作风格' }]}
            >
              <Select placeholder="请选择您希望的总结风格">
                {writingStyles.map(style => (
                  <Option key={style.value} value={style.value}>{style.label}</Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item
              name="summaryPurpose"
              label="总结用途"
              rules={[{ required: true, message: '请选择总结用途' }]}
            >
              <Select placeholder="这份总结主要用于">
                {summaryPurposes.map(purpose => (
                  <Option key={purpose.value} value={purpose.value}>{purpose.label}</Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item
              name="avoidContents"
              label="希望避免的内容"
              extra="选择您不希望在总结中出现的内容类型"
            >
              <Checkbox.Group>
                <Row>
                  {avoidContents.map(content => (
                    <Col span={24} key={content.value} style={{ marginBottom: 8 }}>
                      <Checkbox value={content.value}>{content.label}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
          </Card>
        );
      
      case 3:
        return (
          <Card title="设置完成" className="step-card">
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div>
                <CheckOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
                <Title level={3}>配置即将完成！</Title>
                <Text type="secondary">
                  点击完成按钮，系统将保存您的工作信息配置，
                  并自动关联默认的工作总结提示词模板。
                </Text>
              </div>
            </div>
          </Card>
        );
      
      default:
        return null;
    }
  };

  return (
    <Modal
      title="工作信息配置"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <div style={{ padding: '20px 0' }}>
        <Steps current={current} items={steps} style={{ marginBottom: 32 }} />
        
        <Form
          form={form}
          layout="vertical"
          preserve={false}
        >
          {renderStepContent()}
        </Form>
        

        
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          {current > 0 && (
            <Button style={{ marginRight: 8 }} onClick={prev}>
              上一步
            </Button>
          )}
          {current < steps.length - 1 && (
            <Button type="primary" onClick={next}>
              下一步
            </Button>
          )}
          {current === steps.length - 1 && (
            <Button 
              type="primary" 
              onClick={handleSubmit} 
              loading={loading}
            >
              完成设置
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default WorkProfileSetup;