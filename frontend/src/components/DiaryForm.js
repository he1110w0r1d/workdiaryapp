import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  DatePicker, 
  TimePicker, 
  Select, 
  Button, 
  Card, 
  message,
  Row,
  Col,
  Space,
  Typography,
  Tag,
  Radio
} from 'antd';
import {
  SaveOutlined,
  RollbackOutlined,
  EditOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import locale from 'antd/es/date-picker/locale/zh_CN';

// 设置dayjs全局locale
dayjs.locale('zh-cn');

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

const DiaryForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState({});
  
  // 移除受控状态，使用Form管理

  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) {
      fetchDiary();
    } else {
      const today = dayjs();
      const now = dayjs();
      
      const defaultValues = {
        content: '',
        location: '',
        tags: [],
        startDate: today,
        endDate: today,
        startTime: now,
        endTime: now.add(1, 'hour'),
        workPriority: '中'
      };
      
      setInitialValues(defaultValues);
      form.setFieldsValue(defaultValues);
    }
  }, [id, isEdit, form]);

  const fetchDiary = async () => {
    try {
      const response = await api.get(`/diaries/${id}`);  // 修改这里
      const diary = response.data;
      
      const startMoment = dayjs(diary.startTime).isValid() ? dayjs(diary.startTime) : dayjs();
      const endMoment = dayjs(diary.endTime).isValid() ? dayjs(diary.endTime) : dayjs();
      
      const initialValues = {
        content: diary.content,
        location: diary.location,
        tags: diary.tags,
        workPriority: diary.workPriority || '中',
        startDate: startMoment,
        endDate: endMoment,
        startTime: startMoment,
        endTime: endMoment
      };
      
      setInitialValues(initialValues);
      form.setFieldsValue(initialValues);
    } catch (error) {
      message.error('获取日记失败');
      navigate('/app/diaries');
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const diaryData = {
        content: values.content,
        location: values.location || '',
        tags: values.tags || [],
        workPriority: values.workPriority || '中',
        startTime: dayjs(values.startDate)
          .hour(values.startTime.hour())
          .minute(values.startTime.minute())
          .second(0)
          .millisecond(0)
          .toISOString(),
        endTime: dayjs(values.endDate)
          .hour(values.endTime.hour())
          .minute(values.endTime.minute())
          .second(0)
          .millisecond(0)
          .toISOString()
        };

      if (isEdit) {
        await api.put(`/diaries/${id}`, diaryData);
        message.success('日记更新成功');
      } else {
        await api.post('/diaries', diaryData);
        message.success('日记创建成功');
      }
      
      navigate('/app/diaries');
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const commonTags = ['会议', '工地现场', '沟通', '紧急', '重要'];
  const [selectedTags, setSelectedTags] = useState([]);
  const [workPriority, setWorkPriority] = useState('中');
  const [customTagInput, setCustomTagInput] = useState('');

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Card 
        title={
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-start',
            gap: '8px',

            margin: '-24px -24px 24px',
            padding: '20px 24px',
            color: 'white'
          }}>
            {id ? <EditOutlined /> : <PlusOutlined />}
            <Title level={3} style={{ margin: '40px 0 0 0', color: 'black' }}>
              {id ? '✏️ 编辑工作日记' : '📝 新增工作日记'}
            </Title>
          </div>
        }
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
        }}
        className="float"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={initialValues}
        >
        <Form.Item
          name="content"
          label="工作内容"
          rules={[{ required: true, message: '请输入工作内容' }]}
        >
          <TextArea rows={4} placeholder="详细描述工作内容" />
        </Form.Item>

        <Form.Item name="location" label="地点">
          <Input placeholder="工作地点（可选）" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="startDate"
              label="开始日期"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <DatePicker 
                format="YYYY-MM-DD" 
                style={{ width: '100%' }} 
                placeholder="请选择开始日期"
                allowClear={false}
                locale={locale}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="startTime"
              label="开始时间"
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="endDate"
              label="结束日期"
              rules={[{ required: true, message: '请选择结束日期' }]}
            >
              <DatePicker 
                format="YYYY-MM-DD" 
                style={{ width: '100%' }} 
                placeholder="请选择结束日期"
                allowClear={false}
                locale={locale}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="endTime"
              label="结束时间"
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="tags" label="标签">
          <Input type="hidden" />
        </Form.Item>
        
        {/* 标签选择区域 - 移到Form.Item外部 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>标签选择：</div>
          <div>
            {/* 预设标签按钮 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {commonTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Tag.CheckableTag
                    key={tag}
                    checked={isSelected}
                    onChange={(checked) => {
                      if (checked) {
                        const newTags = [...selectedTags, tag];
                        setSelectedTags(newTags);
                        form.setFieldsValue({ tags: newTags });
                      } else {
                        const newTags = selectedTags.filter(t => t !== tag);
                        setSelectedTags(newTags);
                        form.setFieldsValue({ tags: newTags });
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      border: isSelected ? '2px solid #1890ff' : '2px solid #d9d9d9',
                      backgroundColor: isSelected ? '#e6f7ff' : '#fafafa',
                      color: isSelected ? '#1890ff' : '#666',
                      boxShadow: isSelected ? '0 2px 8px rgba(24, 144, 255, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {tag}
                  </Tag.CheckableTag>
                );
              })}
            </div>
            
            {/* 自定义标签输入 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Input
                placeholder="输入自定义标签"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onPressEnter={() => {
                  if (customTagInput.trim() && !selectedTags.includes(customTagInput.trim())) {
                    const newTags = [...selectedTags, customTagInput.trim()];
                    setSelectedTags(newTags);
                    form.setFieldsValue({ tags: newTags });
                    setCustomTagInput('');
                  }
                }}
                style={{
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '14px'
                }}
              />
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  if (customTagInput.trim() && !selectedTags.includes(customTagInput.trim())) {
                    const newTags = [...selectedTags, customTagInput.trim()];
                    setSelectedTags(newTags);
                    form.setFieldsValue({ tags: newTags });
                    setCustomTagInput('');
                  }
                }}
                style={{
                  borderRadius: '20px',
                  fontSize: '12px',
                  height: '32px'
                }}
              >
                添加
              </Button>
            </div>
            
            {/* 已选择的标签显示 */}
            {selectedTags.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>已选择的标签：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedTags.map(tag => (
                    <Tag
                      key={tag}
                      closable
                      onClose={() => {
                        const newTags = selectedTags.filter(t => t !== tag);
                        setSelectedTags(newTags);
                        form.setFieldsValue({ tags: newTags });
                      }}
                      style={{
                        borderRadius: '12px',
                        fontSize: '12px',
                        backgroundColor: '#f0f0f0',
                        border: '1px solid #d9d9d9'
                      }}
                    >
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Form.Item name="workPriority" label="工作优先级">
          <Input type="hidden" />
        </Form.Item>
        
        {/* 工作优先级选择区域 - 移到Form.Item外部 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>优先级选择：</div>
          <div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['高', '中', '低'].map(priority => {
                const isSelected = workPriority === priority;
                let color, bgColor, shadowColor, emoji;
                
                if (priority === '高') {
                  color = isSelected ? '#ff4d4f' : '#666';
                  bgColor = isSelected ? '#fff2f0' : '#fafafa';
                  shadowColor = 'rgba(255, 77, 79, 0.2)';
                  emoji = '🔴';
                } else if (priority === '中') {
                  color = isSelected ? '#faad14' : '#666';
                  bgColor = isSelected ? '#fffbe6' : '#fafafa';
                  shadowColor = 'rgba(250, 173, 20, 0.2)';
                  emoji = '🟡';
                } else {
                  color = isSelected ? '#52c41a' : '#666';
                  bgColor = isSelected ? '#f6ffed' : '#fafafa';
                  shadowColor = 'rgba(82, 196, 26, 0.2)';
                  emoji = '🟢';
                }
                
                return (
                  <div
                    key={priority}
                    onClick={() => {
                      setWorkPriority(priority);
                      form.setFieldsValue({ workPriority: priority });
                      // 强制触发表单字段更新
                      form.validateFields(['workPriority']);
                    }}
                    style={{
                      borderRadius: '20px',
                      padding: '8px 20px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      border: isSelected ? `2px solid ${color}` : '2px solid #d9d9d9',
                      backgroundColor: bgColor,
                      color: color,
                      boxShadow: isSelected ? `0 2px 8px ${shadowColor}` : '0 1px 3px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '80px'
                    }}
                  >
                    {emoji} {priority}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Form.Item>
          <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              size="large"
              icon={<SaveOutlined />}
              style={{
                background: 'linear-gradient(135deg, #1890ff, #52c41a)',
                border: 'none',
                borderRadius: '8px',
                height: '48px',
                padding: '0 32px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
              className="pulse"
            >
              {id ? '💾 更新日记' : '✨ 创建日记'}
            </Button>
            <Button 
              onClick={() => navigate('/app/diaries')}
              size="large"
              icon={<RollbackOutlined />}
              style={{
                borderRadius: '8px',
                height: '48px',
                padding: '0 32px',
                fontSize: '16px'
              }}
            >
              🔙 返回列表
            </Button>
          </Space>
        </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default DiaryForm;