import React from 'react';
import { Link } from 'react-router-dom';
import { BookOutlined, ArrowRightOutlined } from '@ant-design/icons';
export function Brand() {
  return <span className="brand"><span className="brand-mark"><BookOutlined /></span><span>工作日记<small>WORKDIARY</small></span></span>;
}
export default function AuthFrame({ title, subtitle, children }) {
  return <main className="auth-page">
    <section className="auth-story">
      <Link to="/welcome" className="brand-link"><Brand /></Link>
      <div className="auth-story-copy"><span className="eyebrow">YOUR EVERYDAY WORKSPACE</span>
        <h1>把每一天的工作，<br />写成自己的积累。</h1>
        <p>留下一笔进展，理清下一步。<br />让日常记录，成为回顾时有据可循的答案。</p>
        <div className="auth-note"><span className="eyebrow">从记录，到行动</span><div><span>记录工作</span><ArrowRightOutlined /><span>整理回顾</span><ArrowRightOutlined /><span>继续向前</span></div></div>
      </div>
      <span className="auth-story-footer">留住过程，也看见成长。</span>
    </section>
    <section className="auth-form-side"><div className="auth-mobile-brand"><Link to="/welcome"><Brand /></Link></div>
      <div className="auth-form"><span className="eyebrow">WORKDIARY · 工作日记</span><h2>{title}</h2><p className="auth-subtitle">{subtitle}</p>{children}</div>
      <span className="auth-footer">记录 · 行动 · 回顾</span>
    </section>
  </main>;
}
