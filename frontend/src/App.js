import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'moment/locale/zh-cn';

import Login from './components/Login';
import Register from './components/Register';
import Welcome from './components/Welcome';
import LLMSetupGuide from './components/LLMSetupGuide';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import DiaryList from './components/DiaryList';
import DiaryForm from './components/DiaryForm';
import SummaryList from './components/SummaryList';
import UserSettings from './components/UserSettings';
import UserSettingsPage from './components/UserSettingsPage';
import ModelSettings from './components/ModelSettings';
import Layout from './components/Layout';
import RootRedirect from './components/RootRedirect';

import './App.css';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
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
              <Route path="summaries" element={<SummaryList />} />
              <Route path="model-settings" element={<ModelSettings />} />
              <Route path="user-settings" element={<UserSettingsPage />} />
            </Route>
            <Route path="/" element={<RootRedirect />} />
          </Routes>
        </div>
      </Router>
    </ConfigProvider>
  );
}

export default App;