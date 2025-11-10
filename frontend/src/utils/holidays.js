// 中国法定节假日数据
// 数据来源：国务院办公厅关于节假日安排的通知

const holidays = {
  // 2024年节假日
  '2024': {
    '2024-01-01': { name: '元旦', type: 'holiday' },
    '2024-02-10': { name: '春节', type: 'holiday' },
    '2024-02-11': { name: '春节', type: 'holiday' },
    '2024-02-12': { name: '春节', type: 'holiday' },
    '2024-02-13': { name: '春节', type: 'holiday' },
    '2024-02-14': { name: '春节', type: 'holiday' },
    '2024-02-15': { name: '春节', type: 'holiday' },
    '2024-02-16': { name: '春节', type: 'holiday' },
    '2024-02-17': { name: '春节', type: 'holiday' },
    '2024-04-04': { name: '清明节', type: 'holiday' },
    '2024-04-05': { name: '清明节', type: 'holiday' },
    '2024-04-06': { name: '清明节', type: 'holiday' },
    '2024-05-01': { name: '劳动节', type: 'holiday' },
    '2024-05-02': { name: '劳动节', type: 'holiday' },
    '2024-05-03': { name: '劳动节', type: 'holiday' },
    '2024-05-04': { name: '劳动节', type: 'holiday' },
    '2024-05-05': { name: '劳动节', type: 'holiday' },
    '2024-06-10': { name: '端午节', type: 'holiday' },
    '2024-09-15': { name: '中秋节', type: 'holiday' },
    '2024-09-16': { name: '中秋节', type: 'holiday' },
    '2024-09-17': { name: '中秋节', type: 'holiday' },
    '2024-10-01': { name: '国庆节', type: 'holiday' },
    '2024-10-02': { name: '国庆节', type: 'holiday' },
    '2024-10-03': { name: '国庆节', type: 'holiday' },
    '2024-10-04': { name: '国庆节', type: 'holiday' },
    '2024-10-05': { name: '国庆节', type: 'holiday' },
    '2024-10-06': { name: '国庆节', type: 'holiday' },
    '2024-10-07': { name: '国庆节', type: 'holiday' },
    // 调休工作日
    '2024-02-04': { name: '春节调休', type: 'workday' },
    '2024-02-18': { name: '春节调休', type: 'workday' },
    '2024-04-07': { name: '清明节调休', type: 'workday' },
    '2024-04-28': { name: '劳动节调休', type: 'workday' },
    '2024-05-11': { name: '劳动节调休', type: 'workday' },
    '2024-09-14': { name: '中秋节调休', type: 'workday' },
    '2024-09-29': { name: '国庆节调休', type: 'workday' },
    '2024-10-12': { name: '国庆节调休', type: 'workday' }
  },
  // 2025年节假日
  '2025': {
    '2025-01-01': { name: '元旦', type: 'holiday' },
    '2025-01-28': { name: '春节', type: 'holiday' },
    '2025-01-29': { name: '春节', type: 'holiday' },
    '2025-01-30': { name: '春节', type: 'holiday' },
    '2025-01-31': { name: '春节', type: 'holiday' },
    '2025-02-01': { name: '春节', type: 'holiday' },
    '2025-02-02': { name: '春节', type: 'holiday' },
    '2025-02-03': { name: '春节', type: 'holiday' },
    '2025-04-05': { name: '清明节', type: 'holiday' },
    '2025-04-06': { name: '清明节', type: 'holiday' },
    '2025-04-07': { name: '清明节', type: 'holiday' },
    '2025-05-01': { name: '劳动节', type: 'holiday' },
    '2025-05-02': { name: '劳动节', type: 'holiday' },
    '2025-05-03': { name: '劳动节', type: 'holiday' },
    '2025-05-04': { name: '劳动节', type: 'holiday' },
    '2025-05-05': { name: '劳动节', type: 'holiday' },
    '2025-05-31': { name: '端午节', type: 'holiday' },
    '2025-06-02': { name: '端午节', type: 'holiday' },
    '2025-10-01': { name: '国庆节', type: 'holiday' },
    '2025-10-02': { name: '国庆节', type: 'holiday' },
    '2025-10-03': { name: '国庆节', type: 'holiday' },
    '2025-10-04': { name: '国庆节', type: 'holiday' },
    '2025-10-05': { name: '国庆节', type: 'holiday' },
    '2025-10-06': { name: '国庆节', type: 'holiday' },
    '2025-10-07': { name: '国庆节', type: 'holiday' },
    '2025-10-08': { name: '国庆节', type: 'holiday' },
    // 调休工作日
    '2025-01-26': { name: '春节调休', type: 'workday' },
    '2025-02-08': { name: '春节调休', type: 'workday' },
    '2025-04-27': { name: '劳动节调休', type: 'workday' },
    '2025-09-28': { name: '国庆节调休', type: 'workday' },
    '2025-10-11': { name: '国庆节调休', type: 'workday' }
  }
  ,
  // 2026年节假日（依据国务院办公厅通知）
  '2026': {
    // 元旦
    '2026-01-01': { name: '元旦', type: 'holiday' },
    '2026-01-02': { name: '元旦', type: 'holiday' },
    '2026-01-03': { name: '元旦', type: 'holiday' },
    // 调休工作日
    '2026-01-04': { name: '元旦调休', type: 'workday' },

    // 春节
    '2026-02-15': { name: '春节', type: 'holiday' },
    '2026-02-16': { name: '春节', type: 'holiday' },
    '2026-02-17': { name: '春节', type: 'holiday' },
    '2026-02-18': { name: '春节', type: 'holiday' },
    '2026-02-19': { name: '春节', type: 'holiday' },
    '2026-02-20': { name: '春节', type: 'holiday' },
    '2026-02-21': { name: '春节', type: 'holiday' },
    '2026-02-22': { name: '春节', type: 'holiday' },
    '2026-02-23': { name: '春节', type: 'holiday' },
    // 调休工作日
    '2026-02-14': { name: '春节调休', type: 'workday' },
    '2026-02-28': { name: '春节调休', type: 'workday' },

    // 清明节
    '2026-04-04': { name: '清明节', type: 'holiday' },
    '2026-04-05': { name: '清明节', type: 'holiday' },
    '2026-04-06': { name: '清明节', type: 'holiday' },

    // 劳动节
    '2026-05-01': { name: '劳动节', type: 'holiday' },
    '2026-05-02': { name: '劳动节', type: 'holiday' },
    '2026-05-03': { name: '劳动节', type: 'holiday' },
    '2026-05-04': { name: '劳动节', type: 'holiday' },
    '2026-05-05': { name: '劳动节', type: 'holiday' },
    // 调休工作日
    '2026-05-09': { name: '劳动节调休', type: 'workday' },

    // 端午节
    '2026-06-19': { name: '端午节', type: 'holiday' },
    '2026-06-20': { name: '端午节', type: 'holiday' },
    '2026-06-21': { name: '端午节', type: 'holiday' },

    // 中秋节
    '2026-09-25': { name: '中秋节', type: 'holiday' },
    '2026-09-26': { name: '中秋节', type: 'holiday' },
    '2026-09-27': { name: '中秋节', type: 'holiday' },

    // 国庆节
    '2026-10-01': { name: '国庆节', type: 'holiday' },
    '2026-10-02': { name: '国庆节', type: 'holiday' },
    '2026-10-03': { name: '国庆节', type: 'holiday' },
    '2026-10-04': { name: '国庆节', type: 'holiday' },
    '2026-10-05': { name: '国庆节', type: 'holiday' },
    '2026-10-06': { name: '国庆节', type: 'holiday' },
    '2026-10-07': { name: '国庆节', type: 'holiday' },
    // 调休工作日
    '2026-09-20': { name: '国庆节调休', type: 'workday' },
    '2026-10-10': { name: '国庆节调休', type: 'workday' }
  }
};

// 获取指定日期的节假日信息
export const getHolidayInfo = (date) => {
  const dateStr = date.format('YYYY-MM-DD');
  const year = date.format('YYYY');
  
  if (holidays[year] && holidays[year][dateStr]) {
    return holidays[year][dateStr];
  }
  
  return null;
};

// 判断是否为节假日
export const isHoliday = (date) => {
  const holidayInfo = getHolidayInfo(date);
  return holidayInfo && holidayInfo.type === 'holiday';
};

// 判断是否为调休工作日
export const isWorkday = (date) => {
  const holidayInfo = getHolidayInfo(date);
  return holidayInfo && holidayInfo.type === 'workday';
};

export default holidays;