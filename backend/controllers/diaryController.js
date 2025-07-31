const Diary = require('../models/Diary');

exports.createDiary = async (req, res) => {
  try {
    const { content, location, startTime, endTime, tags, workPriority } = req.body;
    
    const diary = new Diary({
      user: req.user.id,
      content,
      location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      tags: tags || [],
      workPriority: workPriority || '中'
    });

    await diary.save();
    
    res.status(201).json(diary);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getDiaries = async (req, res) => {
  try {
    const { startDate, endDate, search, page = 1, limit = 10 } = req.query;
    
    let query = { user: req.user.id };
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // 设置结束日期为当天的23:59:59.999
      end.setHours(23, 59, 59, 999);
      
      query.startTime = {
        $gte: start,
        $lte: end
      };
    }
    
    if (search) {
      query.$or = [
        { content: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const diaries = await Diary.find(query)
      .sort({ startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Diary.countDocuments(query);

    res.json({
      diaries,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDiaryById = async (req, res) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!diary) {
      return res.status(404).json({ message: '日记未找到' });
    }

    res.json(diary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDiary = async (req, res) => {
  try {
    const { content, location, startTime, endTime, tags, workPriority } = req.body;
    
    const diary = await Diary.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        content,
        location,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        tags: tags || [],
        workPriority: workPriority !== undefined ? workPriority : '中',
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!diary) {
      return res.status(404).json({ message: '日记未找到' });
    }

    res.json(diary);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteDiary = async (req, res) => {
  try {
    const diary = await Diary.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!diary) {
      return res.status(404).json({ message: '日记未找到' });
    }

    res.json({ message: '日记删除成功' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};