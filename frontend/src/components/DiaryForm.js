import React, { useState, useEffect, useRef } from 'react';
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
  Tag,
  Row,
  Col,
  Alert,
  Collapse,
  Modal
} from 'antd';
import {
  SaveOutlined,
  RollbackOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import locale from 'antd/es/date-picker/locale/zh_CN';

// 设置dayjs全局locale
dayjs.locale('zh-cn');

const { TextArea } = Input;

const DiaryForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState({});
  const [draftKey, setDraftKey] = useState(null);
  const [savedDraft, setSavedDraft] = useState(null);
  const dirty = useRef(false);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    api.get('/users/profile').then(({ data }) => {
      if (!active || !data._id) return;
      const key = `workdiary-draft:${data._id}:${id || 'new'}`;
      setDraftKey(key);
      try { setSavedDraft(JSON.parse(sessionStorage.getItem(key) || 'null')); } catch (_) {}
    }).catch(() => {});
    const warn = event => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    const guardLink = event => {
      const anchor = event.target.closest?.('a[href]');
      if (!dirty.current || !anchor || event.ctrlKey || event.metaKey || anchor.target === '_blank') return;
      if (new URL(anchor.href).origin !== window.location.origin) return;
      event.preventDefault(); event.stopPropagation();
      Modal.confirm({ title: '离开未提交的记录？', content: '已缓存的草稿可在当前标签页恢复。', okText: '离开', cancelText: '继续编辑',
        onOk: () => { dirty.current = false; navigate(new URL(anchor.href).pathname + new URL(anchor.href).search); } });
    };
    document.addEventListener('click', guardLink, true);
    window.addEventListener('beforeunload', warn);
    return () => { active = false; document.removeEventListener('click', guardLink, true); window.removeEventListener('beforeunload', warn); };
  }, [id]);

  const leaveTo = path => {
    if (!dirty.current) { navigate(path); return; }
    Modal.confirm({ title: '离开未提交的记录？', content: '已缓存的草稿可在当前标签页恢复。', okText: '离开', cancelText: '继续编辑',
      onOk: () => { dirty.current = false; navigate(path); } });
  };
  const saveDraft = () => {
    dirty.current = true;
    if (draftKey) {
      try { sessionStorage.setItem(draftKey, JSON.stringify(form.getFieldsValue(true))); } catch (_) {}
    }
  };
  const restoreDraft = () => {
    const values = { ...savedDraft };
    for (const key of ['startDate', 'endDate', 'startTime', 'endTime']) {
      if (values[key]) values[key] = dayjs(values[key]);
    }
    form.setFieldsValue(values);
    setSelectedTags(values.tags || []);
    setWorkPriority(values.workPriority || '中');
    dirty.current = true;
    setSavedDraft(null);
  };
  
  // 移除受控状态，使用Form管理

  const isEdit = !!id;

  useEffect(() => {
    if (isEdit) {
      fetchDiary();
    } else {
      const requestedDate = searchParams.get('date');
      const parsedDate = dayjs(requestedDate);
      const today = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || '') && parsedDate.isValid() && parsedDate.format('YYYY-MM-DD') === requestedDate ? parsedDate : dayjs();
      const now = dayjs();
      
      const defaultValues = {
        content: '',
        location: '',
        tags: [],
        startDate: today,
        endDate: now.add(1, 'hour').isSame(now, 'day') ? today : today.add(1, 'day'),
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
  }, [id, isEdit, form, searchParams]);

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
        todoDueDate: diary.relatedTodo?.dueDate ? dayjs(diary.relatedTodo.dueDate) : null,
        todoPriority: diary.workPriority || '中'
      };
      
      setIsTodo(diary.isTodo || false);
      setWorkPriority(diary.workPriority || '中');
      setSelectedTags(diary.tags || []);
      
      setInitialValues(initialValues);
      form.setFieldsValue(initialValues);
    } catch (error) {
      message.error('获取日记失败');
      navigate('/app/diaries');
    }
  };

  const onFinish = async (values) => {
    if (submitting.current) return;
    const start = dayjs(values.startDate).hour(values.startTime.hour()).minute(values.startTime.minute());
    const end = dayjs(values.endDate).hour(values.endTime.hour()).minute(values.endTime.minute());
    if (end.isBefore(start)) { message.error('结束时间不能早于开始时间'); return; }
    submitting.current = true;
    setLoading(true);
    try {
      // 检查并保存新的自定义标签
      const currentTags = values.tags || [];
      
      const newCustomTags = currentTags.filter(tag => !commonTags.includes(tag) && !userCustomTags.includes(tag));
      
      if (newCustomTags.length > 0) {
        const updatedCustomTags = [...userCustomTags, ...newCustomTags];
        setUserCustomTags(updatedCustomTags);
        setCommonTags([...commonTags, ...newCustomTags]);
        // 保存到后端
        await saveCustomTagsToBackend(updatedCustomTags);
      } else {
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
          .toISOString()
        };

      if (isEdit) {
        await api.put(`/diaries/${id}`, diaryData);
        message.success('日记更新成功');
      } else {
        await api.post('/diaries', diaryData);
        message.success('日记创建成功');
      }
      
      // 如果涉及待办事项，触发事件通知其他组件更新
      if (values.isTodo) {
        window.dispatchEvent(new CustomEvent('todosUpdated'));
      }
      
      dirty.current = false;
      if (draftKey) sessionStorage.removeItem(draftKey);
      navigate(`/app/diaries?date=${dayjs(values.startDate).format('YYYY-MM-DD')}`);
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    } finally {
      submitting.current = false;
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
        return;
      }
      
      const response = await api.get('/users/profile');
      
      if (response.status === 200) {
        const userData = response.data;
        const customTags = userData.workProfile?.customTags || [];
        setUserCustomTags(customTags);
        // 将用户自定义标签合并到commonTags中
        setCommonTags(prev => {
          const defaultTags = ['会议', '工地现场', '沟通', '紧急', '重要'];
          const allTags = [...defaultTags, ...customTags];
          const uniqueTags = [...new Set(allTags)];
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
            margin: '0',
            padding: '0'
          }}>
            
            <img 
              src={process.env.PUBLIC_URL + '/pic/logo2.png'} 
              alt="认真记录每一天"
              className="page-logo"
              style={{ margin: 0 }}
            />
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
        {savedDraft && <Alert type="info" showIcon message="发现此账号在当前浏览器标签页的未提交草稿"
          action={<Space><Button onClick={restoreDraft}>恢复草稿</Button><Button onClick={() => { sessionStorage.removeItem(draftKey); setSavedDraft(null); }}>丢弃草稿</Button></Space>} />}
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={initialValues}
          onValuesChange={saveDraft}
        >
        <Form.Item
          name="content"
          label="工作内容"
          rules={[{ required: true, message: '请输入工作内容' }]}
        >
          <TextArea rows={4} placeholder="详细描述工作内容" />
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

        <Collapse defaultActiveKey={[]} style={{ marginBottom: 16 }} items={[{ key: 'details', label: '补充信息：地点、标签、优先级（可选）', forceRender: true, children: <>
        <Form.Item name="location" label="地点">
          <Input placeholder="工作地点（可选）" />
        </Form.Item>
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
                          saveDraft();
                        } else {
                          const newTags = selectedTags.filter(t => t !== tag);
                          setSelectedTags(newTags);
                          form.setFieldsValue({ tags: newTags });
                          saveDraft();
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
                          saveDraft();
                          
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
                          saveDraft();
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
                          saveDraft();
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
                          saveDraft();
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

        {/* 工作优先级 - 精简容器，移除多余Form.Item标签包装 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>工作优先级</div>
          <Form.Item name="workPriority" noStyle>
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
                      saveDraft();
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
          </Form.Item>
        </div>

        </> }]} />

        {/* 待办功能区域（隐藏） */}
        {/* Divider 已移除以减少占用空间 */}
        
        {/* 隐藏的tags字段，用于表单提交 */}
        <Form.Item name="tags" style={{ display: 'none' }}>
          <Input />
        </Form.Item>

        {isTodo && <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="此记录有关联待办。修改日记不会改变任务内容、截止日期或状态。"
          action={<Button onClick={() => leaveTo('/app/todos')}>管理待办</Button>} />}

        <Form.Item>
          <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              size="large"
              icon={<SaveOutlined />}
              style={{
                background: '#3B82F6',
                border: 'none',
                borderRadius: '8px',
                height: '48px',
                padding: '0 32px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {id ? '💾 更新日记' : '✨ 创建日记'}
            </Button>
            <Button 
              onClick={() => leaveTo('/app/diaries')}
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
