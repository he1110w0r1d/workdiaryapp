import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  message, 
  Modal, 
  Typography, 
  Alert,
  Progress,
  Spin,
  Select
} from 'antd';
import { 
  CloudDownloadOutlined, 
  CloudUploadOutlined, 
  FileTextOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;

const BackupRestore = () => {
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [backupInfo, setBackupInfo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [restoreStrategy, setRestoreStrategy] = useState('merge'); // merge | overwrite | skip

  const [capability, setCapability] = useState(null);
  const [restoreStage, setRestoreStage] = useState('');
  const [restorePreview, setRestorePreview] = useState(null);
  useEffect(() => {
    api.get('/backup/status').then(r => setCapability(r.data)).catch(() => setCapability({ restoreAvailable: false, restoreReason: '无法检查恢复能力，请刷新后重试' }));
  }, []);

  // 创建备份
  const handleBackup = async () => {
    setBackupLoading(true);
    setProgress(0);
    try {
      // 首先检查备份功能是否可用
      try {
        await api.get('/backup/status');
      } catch (statusError) {
        message.warning('备份功能暂不可用，请联系管理员配置后端服务');
        setBackupLoading(false);
        return;
      }
      
      const response = await api.post('/backup/create');
      
      if (response.data.success) {
        message.success('备份创建成功');
        setBackupInfo(response.data.backup);
        setModalVisible(true);
      }
    } catch (error) {
      console.error('备份失败:', error);
      if (error.code === 'ERR_INVALID_CHAR') {
        message.error('备份功能配置错误，请联系管理员');
      } else {
        message.error('备份失败: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setBackupLoading(false);
      setProgress(0);
    }
  };

  const uploadRestore = async (file, dryRun) => {
    const formData = new FormData();
    formData.append('backupFile', file);
    formData.append('strategy', restoreStrategy);
    if (dryRun) formData.append('dryRun', 'true');
    setRestoreStage(dryRun ? '上传并校验备份' : '上传备份');
    setProgress(0);
    return api.post('/backup/restore', formData, {
      onUploadProgress: event => {
        const percent = event.total ? Math.round(event.loaded * 100 / event.total) : 0;
        setProgress(percent);
        if (percent === 100) setRestoreStage(dryRun ? '校验记录与关联关系' : '保存恢复前快照并恢复数据，请勿关闭页面');
      }
    });
  };
  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async event => {
      const file = event.target.files[0];
      if (!file) return;
      setRestoreLoading(true);
      try {
        const response = await uploadRestore(file, true);
        setRestorePreview({ file, counts: response.data.counts });
      } catch (error) { message.error(error.response?.data?.message || '校验失败，现有数据未修改'); }
      finally { setRestoreLoading(false); setProgress(0); }
    };
    input.click();
  };
  const confirmRestore = async () => {
    setRestoreLoading(true);
    try {
      await uploadRestore(restorePreview.file, false);
      message.success('恢复成功');
      window.location.reload();
    } catch (error) { message.error(error.response?.data?.message || '恢复失败，请重试'); }
    finally { setRestoreLoading(false); setProgress(0); }
  };

  // 下载备份文件
  const downloadBackup = async () => {
    if (!backupInfo?.fileName) return;
    
    try {
      const response = await api.get(`/backup/download/${backupInfo.fileName}`, {
        responseType: 'blob'
      });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `workdiary-backup-${backupInfo.timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setModalVisible(false);
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
          <img 
            src={process.env.PUBLIC_URL + '/pic/logo7.png'} 
            alt="数据备份与恢复"
            style={{ height: 60, objectFit: 'contain' }}
          />
        </div>
      }
      style={{ marginBottom: 24 }}
    >
      <Alert
        message="重要提示"
        description="定期备份可以防止数据丢失。恢复操作会覆盖当前数据，请谨慎操作。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Text strong>创建备份</Text>
          <br />
          <Text type="secondary">导出所有日记、待办事项和设置数据</Text>
          <br />
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={backupLoading}
            onClick={handleBackup}
            style={{ marginTop: 8 }}
          >
            立即备份
          </Button>
          
          {backupLoading && <Spin tip="正在创建备份" />}
        </div>

        <div>
          {capability?.restoreReason && <Alert type="warning" showIcon message={capability.restoreReason} />}
          <Text strong>恢复数据</Text>
          <br />
          <Text type="secondary">日记、待办、总结将完整替换；下面的策略仅控制用户资料与配置。目前此入口支持 JSON 备份。</Text>
          <br />
          <Space style={{ marginTop: 8, marginBottom: 8 }}>
            <Text>用户资料与配置：</Text>
            <Select
              value={restoreStrategy}
              onChange={setRestoreStrategy}
              style={{ width: 180 }}
              options={[
                { value: 'merge', label: '合并（不覆盖现有配置）' },
                { value: 'overwrite', label: '覆盖（用备份替换现有配置）' },
                { value: 'skip', label: '跳过（不恢复用户资料与配置）' }
              ]}
            />
          </Space>
          <Button
            type="default"
            icon={<CloudUploadOutlined />}
            loading={restoreLoading}
            onClick={handleRestore}
            disabled={!capability?.restoreAvailable}
            style={{ marginTop: 8 }}
            danger
          >
            恢复数据
          </Button>
          
          {restoreLoading && (
            <div><Text>{restoreStage}</Text><Progress
              percent={progress}
              format={p => `上传 ${p}%`}
              status="active"
              style={{ marginTop: 8, width: 200 }}
            /></div>
          )}
        </div>
      </Space>

          <Modal title="确认完整替换当前数据" open={!!restorePreview} confirmLoading={restoreLoading}
            onCancel={() => !restoreLoading && setRestorePreview(null)} onOk={confirmRestore} okText="保存快照并替换" okButtonProps={{ danger: true }} maskClosable={!restoreLoading}>
            <Alert type="warning" message="这不是日记数据合并。系统会先保存恢复前快照，再完整替换当前日记、待办和总结。" />
            {restorePreview && Object.entries(restorePreview.counts).map(([key, count]) => <p key={key}>{({ diaries: '日记', todos: '待办', summaries: '总结' })[key]}：当前 {count.current} 条 → 导入 {count.incoming} 条</p>)}
            <p>配置策略：{restoreStrategy === 'merge' ? '补充缺失配置' : restoreStrategy === 'skip' ? '保留现有配置' : '使用备份配置'}</p>
            {restoreLoading && <p>{restoreStage}</p>}
          </Modal>
          <Modal
            title="备份创建成功"
            open={modalVisible}
            onCancel={() => setModalVisible(false)}
            footer={[
              <Button key="cancel" onClick={() => setModalVisible(false)}>
                关闭
              </Button>,
              <Button 
                key="download" 
                type="primary" 
                icon={<FileTextOutlined />}
                onClick={downloadBackup}
              >
                下载备份文件
              </Button>
            ]}
          >
            {backupInfo && (
              <div>
                <p>备份已成功创建！</p>
                <p><strong>备份时间：</strong>{new Date(backupInfo.timestamp).toLocaleString()}</p>
                <p><strong>包含数据：</strong></p>
                <ul>
                  <li>日记：{backupInfo.stats?.diaries || 0} 条</li>
                  <li>待办事项：{backupInfo.stats?.todos || 0} 条</li>
                  <li>工作总结：{backupInfo.stats?.summaries || 0} 条</li>
                  <li>LLM配置：{backupInfo.stats?.llmConfigs ?? 0} 条</li>
                  <li>嵌入配置：{backupInfo.stats?.embeddingConfigs ?? 0} 条</li>
                  <li>个人信息：{backupInfo.stats?.hasUserProfile ? '已包含' : '无'}
                  </li>
                </ul>
                <p>请及时下载备份文件并妥善保管。</p>
              </div>
            )}
          </Modal>
        </Card>
      );
    };

export default BackupRestore;