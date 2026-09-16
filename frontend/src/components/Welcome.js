import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightOutlined, FileTextOutlined, CheckSquareOutlined, ReadOutlined } from '@ant-design/icons';
import AuthFrame from './AuthFrame';
export default function Welcome() {
  return <AuthFrame title="让工作，有迹可循。" subtitle="一个安静的空间，容纳你的记录、计划与回顾。">
    <div className="welcome-features"><div><FileTextOutlined /><span><strong>随手记录</strong><small>留住每一次进展和思考</small></span></div><div><CheckSquareOutlined /><span><strong>清晰行动</strong><small>把下一步放进待办</small></span></div><div><ReadOutlined /><span><strong>从容回顾</strong><small>从真实记录中整理工作总结</small></span></div></div>
    <Link to="/login" className="welcome-primary">登录工作空间 <ArrowRightOutlined /></Link><p className="welcome-register">第一次来？<Link to="/register">创建账号</Link></p>
  </AuthFrame>;
}
