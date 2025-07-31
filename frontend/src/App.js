import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'moment/locale/zh-cn';

import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import DiaryList from './components/DiaryList';
import DiaryForm from './components/DiaryForm';
import SummaryList from './components/SummaryList';
import Settings from './components/Settings';
import UserSettings from './components/UserSettings';
import Layout from './components/Layout';

import './App.css';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="diaries" element={<DiaryList />} />
              <Route path="diaries/new" element={<DiaryForm />} />
              <Route path="diaries/:id/edit" element={<DiaryForm />} />

              <Route path="summaries" element={<SummaryList />} />
              <Route path="settings" element={<Settings />} />
              <Route path="user-settings" element={<UserSettings />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </ConfigProvider>
  );
}

export default App;