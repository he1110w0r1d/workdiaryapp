import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import moment from 'moment';
import { getHolidayInfo, isHoliday, isWorkday } from '../utils/holidays';
import './Calendar.css';

// 设置moment.js的locale，让一周从周一开始
moment.updateLocale('zh-cn', {
  week: {
    dow: 1, // Monday is the first day of the week
    doy: 4  // The week that contains Jan 4th is the first week of the year
  }
});

const { Title } = Typography;

const Calendar = () => {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(moment());
  const [diariesData, setDiariesData] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'agenda'
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setViewMode(mobile ? 'agenda' : 'month');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    fetchMonthlyDiaries();
    return () => window.removeEventListener('resize', handleResize);
  }, [currentDate]);

  const fetchMonthlyDiaries = async () => {
    setLoading(true);
    try {
      const startOfMonth = currentDate.clone().startOf('month');
      const endOfMonth = currentDate.clone().endOf('month');

      const response = await api.get('/diaries', {
        params: {
          startDate: startOfMonth.format('YYYY-MM-DD'),
          endDate: endOfMonth.format('YYYY-MM-DD'),
          limit: 1000
        }
      });

      // 按日期分组工作日记
      const groupedDiaries = {};
      response.data.diaries.forEach(diary => {
        const date = moment(diary.startTime).format('YYYY-MM-DD');
        if (!groupedDiaries[date]) {
          groupedDiaries[date] = [];
        }
        groupedDiaries[date].push(diary);
      });

      setDiariesData(groupedDiaries);
    } catch (error) {
      message.error('获取日历数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date) => {
    const dateStr = date.format('YYYY-MM-DD');
    navigate(`/app/diaries?date=${dateStr}`);
  };

  const handleAddDiary = (date, event) => {
    event.stopPropagation(); // 阻止事件冒泡
    const dateStr = date.format('YYYY-MM-DD');
    navigate(`/app/diaries/new?date=${dateStr}`);
  };

  const renderCalendarGrid = () => {
    const startOfMonth = currentDate.clone().startOf('month');
    const endOfMonth = currentDate.clone().endOf('month');
    const startOfWeek = startOfMonth.clone().startOf('week');
    const endOfWeek = endOfMonth.clone().endOf('week');

    const days = [];
    const current = startOfWeek.clone();

    // 生成日历网格
    while (current.isSameOrBefore(endOfWeek)) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const date = current.clone();
        const dateStr = date.format('YYYY-MM-DD');
        const isCurrentMonth = date.month() === currentDate.month();
        const isToday = date.isSame(moment(), 'day');
        const dayDiaries = diariesData[dateStr] || [];
        const holidayInfo = getHolidayInfo(date);
        const isHolidayDay = isHoliday(date);
        const isWorkdayDay = isWorkday(date);

        week.push(
          <div
            key={dateStr}
            className={`calendar-cell ${isCurrentMonth ? 'current-month' : 'other-month'
              } ${isToday ? 'today' : ''} ${isHolidayDay ? 'holiday' : ''
              } ${isWorkdayDay ? 'workday' : ''}`}
            onClick={() => handleDateClick(date)}
            style={{ cursor: 'pointer' }}
          >
            <div className="date-number">{date.date()}</div>
            {holidayInfo && (
              <div className="holiday-indicator">
                {holidayInfo.type === 'holiday' ? '休' : '班'}
              </div>
            )}
            {isCurrentMonth && (
              <div
                className="add-diary-btn"
                onClick={(e) => handleAddDiary(date, e)}
                title="快速新增工作日记"
              >
                +
              </div>
            )}
            <div className="diary-content">
              {dayDiaries.slice(0, 3).map((diary, index) => (
                <div key={diary._id} className="diary-item" title={diary.content}>
                  {diary.content.length > 20
                    ? `${diary.content.substring(0, 20)}...`
                    : diary.content
                  }
                </div>
              ))}
              {dayDiaries.length > 3 && (
                <div className="more-items">+{dayDiaries.length - 3} 更多</div>
              )}
            </div>
          </div>
        );
        current.add(1, 'day');
      }
      days.push(
        <div key={current.format('YYYY-MM-DD')} className="calendar-week">
          {week}
        </div>
      );
    }

    return days;
  };

  const renderAgendaList = () => {
    const startOfMonth = currentDate.clone().startOf('month');
    const endOfMonth = currentDate.clone().endOf('month');
    const days = [];
    const current = startOfMonth.clone();
    // 记录今天的元素引用以便渲染后滚动定位
    const todayStr = moment().format('YYYY-MM-DD');
    let todayElementId = null;
    while (current.isSameOrBefore(endOfMonth)) {
      const dateStr = current.format('YYYY-MM-DD');
      const dayDiaries = diariesData[dateStr] || [];
      days.push(
        <div
          key={dateStr}
          className="agenda-day-card"
          onClick={() => handleDateClick(current)}
          id={dateStr === todayStr ? (todayElementId = `agenda-${dateStr}`) : undefined}
        >
          <div className="agenda-day-header">
            <span className="agenda-date">{current.format('MM-DD')}</span>
            <span className="agenda-weekday">{current.format('dddd')}</span>
            <button className="agenda-add" onClick={(e) => handleAddDiary(current, e)}>+ 新增</button>
          </div>
          <div className="agenda-items">
            {dayDiaries.length === 0 ? (
              <div className="agenda-empty">暂无工作日志</div>
            ) : (
              dayDiaries.map((diary) => (
                <div key={diary._id} className="agenda-item" title={diary.content}>
                  <span className="agenda-time">
                    {moment(diary.startTime).format('HH:mm')} - {moment(diary.endTime).format('HH:mm')}
                  </span>
                  <span className="agenda-content">
                    {diary.content.length > 40 ? `${diary.content.substring(0, 40)}...` : diary.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      );
      current.add(1, 'day');
    }
    // 渲染后滚动到当天（仅移动端且视图为agenda）
    setTimeout(() => {
      try {
        if (viewMode === 'agenda' && isMobile && todayElementId) {
          const el = document.getElementById(todayElementId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      } catch (e) {
        // 静默失败，避免影响主流程
      }
    }, 0);
    return days;
  };

  const navigateMonth = (direction) => {
    setCurrentDate(currentDate.clone().add(direction, 'month'));
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        {/* 用 logo 图片替换“工作日历”文字 */}
        <div className="calendar-logo">
          <img
            src={process.env.PUBLIC_URL + '/pic/logo.png'}
            alt="logo"
            className="page-logo"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
          <div className="calendar-navigation">
            <button
              className="nav-button"
              onClick={() => navigateMonth(-1)}
            >
              {isMobile ? '←' : '← 上月'}
            </button>
            <span className="current-month">
              {currentDate.format('YYYY年MM月')}
            </span>
            <button
              className="nav-button"
              onClick={() => navigateMonth(1)}
            >
              {isMobile ? '→' : '下月 →'}
            </button>
          </div>

          {/* 添加图片链接 - 位于导航按钮右侧 */}
          <div
            className="brain-storm-image"
            onClick={() => {
              const protocol = window.location.protocol || 'http:';
              const host = window.location.hostname || 'localhost';
              const url = `${protocol}//${host}:11188`;
              window.open(url, '_blank');
            }}
            style={{
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'all 0.3s ease',
              display: isMobile ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'none';
            }}
          >
            <img
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjYwIiB2aWV3Qm94PSIwIDAgMTIwIDYwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjYwIiByeD0iOCIgZmlsbD0idXJsKCNncmFkaWVudDApIiBzdHJva2U9InVybCgjZ3JhZGllbnQxKSIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9ImdyYWRpZW50MCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTIwIiB5Mj0iNjAiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzE4MjMzNCIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzNzQxNTEiLz4KPC9saW5lYXJHcmFkaWVudD4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudDEiIHgxPSIwIiB5MT0iMCIgeDI9IjEyMCIgeTI9IjYwIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNGRjAwRkYiLz4KPHN0b3Agb2Zmc2V0PSIwLjUiIHN0b3AtY29sb3I9IiMwMEZGRkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRkZGRjAwIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHRleHQgeD0iNjAiIHk9IjM4IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+YnJhaW4gc3Rvcm08L3RleHQ+Cjwvc3ZnPgo="
              alt="Brain Storm"
              style={{
                width: '120px',
                height: '60px',
                borderRadius: '8px'
              }}
            />
          </div>
        </div>
      </div>

      <Card>
        <div className="calendar-container">
          {viewMode === 'month' ? (
            <>
              <div className="calendar-header">
                {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                  <div key={day} className="weekday-header">{day}</div>
                ))}
              </div>
              <div className="calendar-grid">
                {renderCalendarGrid()}
              </div>
            </>
          ) : (
            <div className="agenda-view">
              {renderAgendaList()}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Calendar;