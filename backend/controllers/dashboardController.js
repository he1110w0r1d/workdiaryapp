const mongoose = require('mongoose');
const Diary = require('../models/Diary');
const Summary = require('../models/Summary');

// Aggregate in the user's explicit timezone; never derive totals from a list page.
exports.getDashboard = async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Asia/Shanghai';
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
    catch (_) { return res.status(400).json({ message: '无效时区' }); }
    const user = new mongoose.Types.ObjectId(req.user.id);
    const now = new Date();
    const duration = { $max: [0, { $divide: [{ $subtract: ['$endTime', '$startTime'] }, 3600000] }] };
    const [result, totalSummaries] = await Promise.all([
      Diary.aggregate([
        { $match: { user, isDeleted: false } },
        { $facet: {
          total: [{ $count: 'count' }],
          today: [{ $match: { $expr: { $eq: [
            { $dateToString: { date: '$startTime', format: '%Y-%m-%d', timezone } },
            { $dateToString: { date: now, format: '%Y-%m-%d', timezone } }
          ] } } }, { $count: 'count' }],
          tags: [{ $unwind: '$tags' }, { $group: { _id: '$tags', value: { $sum: 1 } } }, { $sort: { value: -1, _id: 1 } }, { $limit: 8 }],
          days: [{ $match: { startTime: { $gte: new Date(now.getTime() - 31 * 86400000) } } },
            { $group: { _id: { $dateToString: { date: '$startTime', format: '%Y-%m-%d', timezone } }, hours: { $sum: duration } } }],
          months: [{ $group: { _id: { $dateToString: { date: '$startTime', format: '%Y-%m', timezone } }, entries: { $sum: 1 }, totalHours: { $sum: duration } } }, { $sort: { _id: -1 } }, { $limit: 12 }]
        } }
      ]), Summary.countDocuments({ user })
    ]);
    const data = result[0];
    res.json({ stats: { totalDiaries: data.total[0]?.count || 0, todayDiaries: data.today[0]?.count || 0, totalSummaries },
      tags: data.tags.map(t => ({ name: t._id, value: t.value })), days: data.days,
      months: data.months.reverse().map(m => ({ name: `${m._id.slice(0, 4)}年${Number(m._id.slice(5))}月`, entries: m.entries, totalHours: m.totalHours })) });
  } catch (error) { res.status(500).json({ message: '获取统计失败' }); }
};
