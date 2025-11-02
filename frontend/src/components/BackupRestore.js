import React, { useState } from 'react';
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

  // 恢复备份
  const handleRestore = async () => {
    setRestoreLoading(true);
    setProgress(0);
    try {
      // 创建文件输入元素
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.zip';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('backupFile', file);
        formData.append('strategy', restoreStrategy);
        
        try {
          const response = await api.post('/backup/restore', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setProgress(percent);
            }
          });
          
          if (response.data.success) {
            message.success('恢复成功');
            // 刷新页面以应用恢复的数据
            window.location.reload();
          }
        } catch (error) {
          console.error('恢复失败:', error);
          message.error('恢复失败: ' + (error.response?.data?.message || error.message));
        } finally {
          setRestoreLoading(false);
          setProgress(0);
        }
      };
      
      input.click();
    } catch (error) {
      console.error('恢复失败:', error);
      message.error('恢复失败: ' + (error.response?.data?.message || error.message));
      setRestoreLoading(false);
      setProgress(0);
    }
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
          
          {backupLoading && (
            <Progress
              percent={progress}
              status="active"
              style={{ marginTop: 8, width: 200 }}
            />
          )}
        </div>

        <div>
          <Text strong>恢复数据</Text>
          <br />
          <Text type="secondary">从备份文件恢复数据（会覆盖当前数据）</Text>
          <br />
          <Space style={{ marginTop: 8, marginBottom: 8 }}>
            <Text>恢复策略：</Text>
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
            style={{ marginTop: 8 }}
            danger
          >
            恢复数据
          </Button>
          
          {restoreLoading && (
            <Progress
              percent={progress}
              status="active"
              style={{ marginTop: 8, width: 200 }}
            />
          )}
        </div>
      </Space>

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