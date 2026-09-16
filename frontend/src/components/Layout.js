import React, { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Button, Drawer, Dropdown, Input, Modal, Tooltip } from 'antd';
import { HomeOutlined, FileTextOutlined, CheckSquareOutlined, ReadOutlined, SearchOutlined, SettingOutlined, PlusOutlined, MenuOutlined, LogoutOutlined, BarChartOutlined, DeleteOutlined, CloudDownloadOutlined, ApiOutlined, QuestionCircleOutlined, UserOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import api from '../utils/api';
import { Brand } from './AuthFrame';

const primary = [
  ['/app', '今天', HomeOutlined], ['/app/diaries', '日记', FileTextOutlined],
  ['/app/todos', '待办', CheckSquareOutlined], ['/app/summaries', '总结', ReadOutlined],
  ['/app/rag', '问答', QuestionCircleOutlined]
];
const secondary = [['/app/overview', '数据概览', BarChartOutlined], ['/app/recycle', '回收站', DeleteOutlined], ['/app/user-settings', '设置', SettingOutlined]];
export default function AppLayout() {
  const location = useLocation();
  const searchLink = useRef(null);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({});
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let active = true;
    const profile = () => api.get('/users/profile').then(r => active && setUser(r.data)).catch(() => {});
    const refresh = () => Promise.allSettled([api.get('/todos/stats'), api.get('/summaries/unread/count')]).then(results => {
      if (!active) return;
      setCounts(old => ({
        todos: results[0].status === 'fulfilled' ? results[0].value.data.stats?.statusStats?.find(s => s._id === '待办')?.count || 0 : old.todos,
        summaries: results[1].status === 'fulfilled' ? results[1].value.data.total || 0 : old.summaries
      }));
    });
    profile(); refresh();
    window.addEventListener('userInfoUpdated', profile);
    window.addEventListener('todosUpdated', refresh);
    window.addEventListener('summariesUpdated', refresh);
    return () => { active = false; window.removeEventListener('userInfoUpdated', profile); window.removeEventListener('todosUpdated', refresh); window.removeEventListener('summariesUpdated', refresh); };
  }, []);
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    const handle = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(v => !v); } };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, []);
  const logout = () => {
    const finish = () => { localStorage.removeItem('token'); navigate('/login'); };
    if (window.dispatchEvent(new CustomEvent('workdiary:before-logout', { cancelable: true, detail: { finish } }))) finish();
  };
  const base = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
  const avatar = user?.avatar ? (/^https?:\/\//.test(user.avatar) ? user.avatar : `${base}${user.avatar}`) : undefined;
  const selected = [...primary, ...secondary].find(([path]) => path === '/app' ? location.pathname === path : location.pathname.startsWith(path));
  const title = selected?.[1] || (location.pathname.includes('backup') ? '数据备份' : location.pathname.includes('api-management') ? 'API 管理' : '设置');
  const links = items => items.map(([path, label, Icon]) => <NavLink end={path === '/app'} className={({ isActive }) => `workspace-nav-link ${isActive ? 'is-active' : ''}`} to={path} key={path} title={collapsed ? label : undefined}>
    <Icon /><span className="nav-label">{label}</span>{!collapsed && (path === '/app/todos' ? counts.todos : path === '/app/summaries' ? counts.summaries : 0) > 0 && <span className="nav-count">{Math.min(999, path === '/app/todos' ? counts.todos : counts.summaries)}</span>}
  </NavLink>);
  const nav = <>
    <Link className="sidebar-brand brand-link" to="/app"><Brand /></Link>
    <Link className="sidebar-new" to="/app/diaries/new"><PlusOutlined /><span className="nav-label">记一笔</span></Link>
    <button className="sidebar-search" onClick={() => setSearchOpen(true)} title="搜索日记 (Ctrl+K)"><SearchOutlined /><span className="nav-label">搜索日记</span><kbd>Ctrl K</kbd></button>
    <nav aria-label="主要导航">{links(primary)}</nav>
    <div className="sidebar-bottom"><span className="sidebar-section-label">工作空间</span><nav aria-label="工作空间">{links(secondary)}</nav>
      <Link to="/app/user-settings" className="sidebar-account"><Avatar size={30} src={avatar} icon={<UserOutlined />} /><span className="nav-label">{user?.username || '我的工作空间'}<small>个人空间</small></span></Link>
    </div>
  </>;
  return <div className={`workspace ${collapsed ? 'nav-collapsed' : ''}`}>
    <a className="skip-link" href="#workspace-content">跳到正文</a>
    <aside className="workspace-sidebar">{nav}<Tooltip title={collapsed ? '展开导航' : '收起导航'}><Button className="sidebar-collapse" type="text" aria-label={collapsed ? '展开导航' : '收起导航'} icon={collapsed ? <RightOutlined /> : <LeftOutlined />} onClick={() => setCollapsed(!collapsed)} /></Tooltip></aside>
    <div className="workspace-main"><header className="workspace-topbar">
      <div className="topbar-context"><Button className="mobile-menu" type="text" aria-label="打开导航" icon={<MenuOutlined />} onClick={() => { setCollapsed(false); setDrawer(true); }} /><span className="topbar-space">我的工作空间</span><span className="topbar-divider">/</span><span>{title}</span></div>
      <div className="topbar-actions"><Button type="text" aria-label="搜索日记" icon={<SearchOutlined />} onClick={() => setSearchOpen(true)} /><Link to="/app/diaries/new" className="topbar-capture"><PlusOutlined /> 记一笔</Link><Dropdown trigger={['click']} menu={{ items: [
        { key: 'profile', label: <Link to="/app/user-settings">个人设置</Link>, icon: <SettingOutlined /> },
        { key: 'backup', label: <Link to="/app/backup">数据备份</Link>, icon: <CloudDownloadOutlined /> },
        { key: 'api', label: <Link to="/app/api-management">API 管理</Link>, icon: <ApiOutlined /> },
        { type: 'divider' }, { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: logout }
      ] }}><button className="avatar-button" aria-label="账号菜单"><Avatar size={30} src={avatar} icon={<UserOutlined />} /></button></Dropdown></div>
    </header><main id="workspace-content" className="workspace-content" tabIndex={-1}><Outlet /></main><footer className="workspace-footer">一步一步，把工作理清。</footer></div>
    <Drawer title="工作空间" placement="left" width={270} open={drawer} onClose={() => setDrawer(false)} className="workspace-drawer"><div className="drawer-nav">{nav}</div></Drawer>
    <Modal title="搜索工作日记" open={searchOpen} footer={null} onCancel={() => setSearchOpen(false)} destroyOnClose>
      <p className="muted">按工作内容、地点或标签查找。快捷键 Ctrl / ⌘ K。</p>
      <Input autoFocus size="large" prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => searchLink.current?.click()} placeholder="输入关键词" />
      <Link ref={searchLink} to={`/app/diaries?search=${encodeURIComponent(search.trim())}`} className="search-submit" onClick={() => setSearchOpen(false)}>查看搜索结果 <RightOutlined /></Link>
      <p className="search-tip">需要从多篇记录中找答案？<Link to="/app/rag" onClick={() => setSearchOpen(false)}>试试问答</Link></p>
    </Modal>
  </div>;
}
