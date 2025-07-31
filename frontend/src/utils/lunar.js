// 农历转换工具
// 简化版农历计算，实际项目中建议使用专业的农历库如 lunar-javascript

const lunarMonths = [
  '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '腊月'
];

const lunarDays = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

// 生肖
const zodiacAnimals = [
  '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'
];

// 天干地支
const heavenlyStems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const earthlyBranches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 简化的农历数据（实际应该使用完整的农历数据表）
const lunarData = {
  2024: {
    months: [29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 29, 30], // 每月天数
    leapMonth: 0, // 闰月，0表示无闰月
    newYear: new Date(2024, 1, 10) // 农历新年对应的公历日期
  },
  2025: {
    months: [30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30],
    leapMonth: 6, // 闰六月
    newYear: new Date(2025, 0, 29)
  }
};

/**
 * 获取生肖
 * @param {number} year - 公历年份
 * @returns {string} 生肖
 */
export const getZodiac = (year) => {
  return zodiacAnimals[(year - 4) % 12];
};

/**
 * 获取天干地支年
 * @param {number} year - 公历年份
 * @returns {string} 天干地支年
 */
export const getGanZhi = (year) => {
  const heavenly = heavenlyStems[(year - 4) % 10];
  const earthly = earthlyBranches[(year - 4) % 12];
  return heavenly + earthly;
};

/**
 * 简化的公历转农历
 * @param {Date} date - 公历日期
 * @returns {object} 农历信息
 */
export const solarToLunar = (date) => {
  const year = date.getFullYear();
  const yearData = lunarData[year];
  
  if (!yearData) {
    // 如果没有数据，返回估算值
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return {
      year: year,
      month: Math.min(month, 12),
      day: Math.min(day, 30),
      monthName: lunarMonths[Math.min(month - 1, 11)],
      dayName: lunarDays[Math.min(day - 1, 29)],
      zodiac: getZodiac(year),
      ganZhi: getGanZhi(year),
      isLeapMonth: false
    };
  }
  
  // 计算距离农历新年的天数
  const newYear = yearData.newYear;
  const diffTime = date.getTime() - newYear.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    // 如果在农历新年之前，属于上一年
    return solarToLunar(new Date(year - 1, 11, 31));
  }
  
  // 计算农历月日
  let lunarMonth = 1;
  let remainingDays = diffDays;
  
  for (let i = 0; i < yearData.months.length; i++) {
    if (remainingDays < yearData.months[i]) {
      break;
    }
    remainingDays -= yearData.months[i];
    lunarMonth++;
  }
  
  const lunarDay = remainingDays + 1;
  
  return {
    year: year,
    month: lunarMonth,
    day: lunarDay,
    monthName: lunarMonths[lunarMonth - 1] || '正月',
    dayName: lunarDays[lunarDay - 1] || '初一',
    zodiac: getZodiac(year),
    ganZhi: getGanZhi(year),
    isLeapMonth: yearData.leapMonth === lunarMonth
  };
};

/**
 * 获取农历日期字符串
 * @param {Date} date - 公历日期
 * @returns {string} 农历日期字符串
 */
export const getLunarDateString = (date = new Date()) => {
  const lunar = solarToLunar(date);
  return `${lunar.monthName}${lunar.dayName}`;
};

/**
 * 获取完整的农历信息字符串
 * @param {Date} date - 公历日期
 * @returns {string} 完整农历信息
 */
export const getFullLunarString = (date = new Date()) => {
  const lunar = solarToLunar(date);
  return `${lunar.ganZhi}年 ${lunar.zodiac}年 ${lunar.monthName}${lunar.dayName}`;
};

export default {
  solarToLunar,
  getLunarDateString,
  getFullLunarString,
  getZodiac,
  getGanZhi
};