import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import moment from 'moment';
import { getHolidayInfo, isHoliday, isWorkday } from '../utils/holidays';
import './Calendar.css';

// 设置moment.js的locale，让一周从周一开始
moment.locale('zh-cn', {
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchMonthlyDiaries();
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
            className={`calendar-cell ${
              isCurrentMonth ? 'current-month' : 'other-month'
            } ${isToday ? 'today' : ''} ${
              isHolidayDay ? 'holiday' : ''
            } ${isWorkdayDay ? 'workday' : ''}`}
            onClick={() => isCurrentMonth && handleDateClick(date)}
            style={{ cursor: isCurrentMonth ? 'pointer' : 'default' }}
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
        <Title level={2}>工作日历</Title>
        <div className="calendar-navigation">
          <button 
            className="nav-button" 
            onClick={() => navigateMonth(-1)}
          >
            ← 上月
          </button>
          <span className="current-month">
            {currentDate.format('YYYY年MM月')}
          </span>
          <button 
            className="nav-button" 
            onClick={() => navigateMonth(1)}
          >
            下月 →
          </button>
        </div>
      </div>

      <Card>
        <div className="calendar-container">
          {/* 星期标题 */}
          <div className="calendar-header">
            {['一', '二', '三', '四', '五', '六', '日'].map(day => (
              <div key={day} className="weekday-header">{day}</div>
            ))}
          </div>
          
          {/* 日历网格 */}
          <div className="calendar-grid">
            {renderCalendarGrid()}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Calendar;