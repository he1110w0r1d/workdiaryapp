import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'moment/locale/zh-cn';
import GlobalStyles from './styles/GlobalStyles';

import Login from './components/Login';
import Register from './components/Register';
import Welcome from './components/Welcome';
import LLMSetupGuide from './components/LLMSetupGuide';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import DiaryList from './components/DiaryList';
import DiaryForm from './components/DiaryForm';
import TodoList from './components/TodoList';
import SummaryList from './components/SummaryList';
import UserSettingsPage from './components/UserSettingsPage';
import ModelSettings from './components/ModelSettings';
import RecycleBin from './components/RecycleBin';
import BackupRestore from './components/BackupRestore';
import Layout from './components/Layout';
import RootRedirect from './components/RootRedirect';
import RagQA from './pages/RagQA';
import AIAssistant from './pages/AIAssistant';

import './App.css';

function AppContent() {
  const professionalTheme = {
    name: '专业蓝',
    colors: {
      primary: '#1E3A8A',
      secondary: '#2563EB', 
      accent: '#3B82F6',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#1F2937',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      info: '#2563EB'
    }
  };
  
  return (
    <>
      <GlobalStyles theme={professionalTheme} />
      <Router>
        <div className="App">
          <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/llm-setup" element={<LLMSetupGuide />} />
              <Route path="/app" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="diaries" element={<DiaryList />} />
                <Route path="diaries/new" element={<DiaryForm />} />
                <Route path="diaries/:id/edit" element={<DiaryForm />} />
                <Route path="recycle" element={<RecycleBin />} />
                <Route path="todos" element={<TodoList />} />
                <Route path="summaries" element={<SummaryList />} />
                <Route path="rag" element={<RagQA />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="model-settings" element={<ModelSettings />} />
                <Route path="user-settings" element={<UserSettingsPage />} />
                <Route path="backup" element={<BackupRestore />} />
              </Route>
              <Route path="/" element={<RootRedirect />} />
            </Routes>
          </div>
        </Router>
      </>
  );
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AppContent />
    </ConfigProvider>
  );
}

export default App;