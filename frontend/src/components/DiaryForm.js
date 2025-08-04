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
  Space,
  Typography,
  Tag,
  Radio,
  Switch,
  Divider,
  Row,
  Col
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
        workPriority: '中',
        isTodo: false,
        todoDueDate: today.add(1, 'day'),
        todoPriority: '中'
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
        endTime: endMoment,
        isTodo: diary.isTodo || false,
        todoDueDate: diary.isTodo ? dayjs().add(1, 'day') : dayjs().add(1, 'day'),
        todoPriority: diary.workPriority || '中'
      };
      
      setIsTodo(diary.isTodo || false);
      setSelectedTags(diary.tags || []);
      
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
      // 检查并保存新的自定义标签
      const currentTags = values.tags || [];
      console.log('表单提交 - 当前标签:', currentTags);
      console.log('表单提交 - 预设标签:', commonTags);
      console.log('表单提交 - 用户自定义标签:', userCustomTags);
      
      const newCustomTags = currentTags.filter(tag => !commonTags.includes(tag) && !userCustomTags.includes(tag));
      console.log('表单提交 - 发现新自定义标签:', newCustomTags);
      
      if (newCustomTags.length > 0) {
        const updatedCustomTags = [...userCustomTags, ...newCustomTags];
        console.log('表单提交 - 准备保存自定义标签:', updatedCustomTags);
        setUserCustomTags(updatedCustomTags);
        setCommonTags([...commonTags, ...newCustomTags]);
        // 保存到后端
        await saveCustomTagsToBackend(updatedCustomTags);
      } else {
        console.log('表单提交 - 没有新的自定义标签需要保存');
      }
      
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
          .toISOString(),
        isTodo: values.isTodo || false,
        todoDueDate: values.isTodo ? values.todoDueDate.toISOString() : null
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

  const [commonTags, setCommonTags] = useState(['会议', '工地现场', '沟通', '紧急', '重要']);
  const [userCustomTags, setUserCustomTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [workPriority, setWorkPriority] = useState('中');
  const [customTagInput, setCustomTagInput] = useState('');

  // 获取用户自定义标签
  const fetchUserCustomTags = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('没有找到token，跳过获取用户自定义标签');
        return;
      }
      
      console.log('开始获取用户自定义标签...');
      const response = await api.get('/users/profile');
      
      console.log('用户profile响应:', response);
      if (response.status === 200) {
        const userData = response.data;
        console.log('用户数据:', userData);
        const customTags = userData.workProfile?.customTags || [];
        console.log('提取的自定义标签:', customTags);
        setUserCustomTags(customTags);
        // 将用户自定义标签合并到commonTags中
        setCommonTags(prev => {
          const defaultTags = ['会议', '工地现场', '沟通', '紧急', '重要'];
          const allTags = [...defaultTags, ...customTags];
          const uniqueTags = [...new Set(allTags)];
          console.log('合并后的标签列表:', uniqueTags);
          return uniqueTags;
        });
      }
    } catch (error) {
      console.error('获取用户自定义标签失败:', error);
    }
  };

  // 保存自定义标签到后端
  const saveCustomTagsToBackend = async (tags) => {
    try {
      const response = await api.put('/users/custom-tags', {
        customTags: tags
      });
      if (response.status === 200) {
        const result = response.data;
        console.log('自定义标签保存成功:', result);
      }
    } catch (error) {
      console.error('保存自定义标签失败:', error);
    }
  };
  const [isTodo, setIsTodo] = useState(false);

  // 组件加载时获取用户自定义标签
  useEffect(() => {
    // 确保基础标签始终存在
    const defaultTags = ['会议', '工地现场', '沟通', '紧急', '重要'];
    setCommonTags(defaultTags);
    
    // 然后尝试获取用户自定义标签
    fetchUserCustomTags();
  }, []);

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
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px', padding: '12px 16px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
          💡 为了更好地使用系统，建议每次只填写单项工作内容，多项工作请分别填写
        </div>
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

        {/* 标签选择区域 */}
        <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: '500', color: '#262626', textAlign: 'left' }}>标签</div>
        <div style={{ marginBottom: '24px' }}>
          {/* 预设标签按钮 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {commonTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                const isCustomTag = userCustomTags.includes(tag);
                return (
                  <div
                    key={tag}
                    style={{
                      position: 'relative',
                      display: 'inline-block'
                    }}
                    onMouseEnter={(e) => {
                      if (isCustomTag) {
                        const deleteBtn = e.currentTarget.querySelector('.delete-btn');
                        if (deleteBtn) deleteBtn.style.display = 'flex';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isCustomTag) {
                        const deleteBtn = e.currentTarget.querySelector('.delete-btn');
                        if (deleteBtn) deleteBtn.style.display = 'none';
                      }
                    }}
                  >
                    <Tag.CheckableTag
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
                    {isCustomTag && (
                      <div
                        className="delete-btn"
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: '#ff4d4f',
                          color: 'white',
                          display: 'none',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          zIndex: 10,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                        }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          // 从所有相关状态中移除该标签
                          const updatedCustomTags = userCustomTags.filter(t => t !== tag);
                          const updatedCommonTags = commonTags.filter(t => t !== tag);
                          const updatedSelectedTags = selectedTags.filter(t => t !== tag);
                          
                          setUserCustomTags(updatedCustomTags);
                          setCommonTags(updatedCommonTags);
                          setSelectedTags(updatedSelectedTags);
                          form.setFieldsValue({ tags: updatedSelectedTags });
                          
                          // 保存到后端
                          await saveCustomTagsToBackend(updatedCustomTags);
                        }}
                      >
                        ×
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* 自定义标签输入 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Input
                placeholder="输入自定义标签"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onPressEnter={async () => {
                  if (customTagInput.trim() && !selectedTags.includes(customTagInput.trim())) {
                    const newTag = customTagInput.trim();
                    const newTags = [...selectedTags, newTag];
                    setSelectedTags(newTags);
                    form.setFieldsValue({ tags: newTags });
                    // 如果新标签不在预设标签中，则添加到预设标签列表和用户自定义标签
                    if (!commonTags.includes(newTag)) {
                      setCommonTags([...commonTags, newTag]);
                      const updatedCustomTags = [...userCustomTags, newTag];
                      setUserCustomTags(updatedCustomTags);
                      // 保存到后端
                      await saveCustomTagsToBackend(updatedCustomTags);
                    }
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
                onClick={async () => {
                  if (customTagInput.trim() && !selectedTags.includes(customTagInput.trim())) {
                    const newTag = customTagInput.trim();
                    const newTags = [...selectedTags, newTag];
                    setSelectedTags(newTags);
                    form.setFieldsValue({ tags: newTags });
                    // 如果新标签不在预设标签中，则添加到预设标签列表和用户自定义标签
                    if (!commonTags.includes(newTag)) {
                      setCommonTags([...commonTags, newTag]);
                      const updatedCustomTags = [...userCustomTags, newTag];
                      setUserCustomTags(updatedCustomTags);
                      // 保存到后端
                      await saveCustomTagsToBackend(updatedCustomTags);
                    }
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

        <Form.Item label="工作优先级">
        </Form.Item>
        
        {/* 工作优先级选择区域 - 移到Form.Item外部 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>优先级选择：</div>
          <div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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

        {/* 待办功能区域 */}
        <Divider orientation="left" style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>
          📋 待办设置
        </Divider>
        
        {/* 隐藏的tags字段，用于表单提交 */}
        <Form.Item name="tags" style={{ display: 'none' }}>
          <Input />
        </Form.Item>

        <Form.Item name="isTodo" valuePropName="checked">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Switch 
              checked={isTodo}
              onChange={(checked) => {
                setIsTodo(checked);
                form.setFieldsValue({ isTodo: checked });
              }}
              style={{ backgroundColor: isTodo ? '#52c41a' : '#d9d9d9' }}
            />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              {isTodo ? '✅ 设为待办事项' : '⭕ 不设为待办'}
            </span>
          </div>
        </Form.Item>
        
        {isTodo && (
          <div style={{ 
            backgroundColor: '#fafafa', 
            border: '1px solid #e8e8e8', 
            borderRadius: '8px', 
            padding: '16px', 
            marginTop: '16px' 
          }}>
            <Form.Item
              name="todoDueDate"
              label="待办截止日期"
              rules={[{ required: isTodo, message: '请选择待办截止日期' }]}
              style={{ marginBottom: '16px' }}
            >
              <DatePicker 
                format="YYYY-MM-DD" 
                style={{ width: '100%' }} 
                placeholder="请选择截止日期"
                locale={locale}
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>
            

            
            <div style={{ 
              backgroundColor: '#f0f8ff', 
              border: '1px solid #d6e4ff', 
              borderRadius: '6px', 
              padding: '12px', 
              marginTop: '16px'
            }}>
              <div style={{ fontSize: '12px', color: '#1890ff', marginBottom: '4px' }}>
                💡 待办提示：
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                设为待办后，此工作内容将出现在待办列表中，您可以在导航栏的待办区域进行管理。
              </div>
            </div>
          </div>
        )}

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