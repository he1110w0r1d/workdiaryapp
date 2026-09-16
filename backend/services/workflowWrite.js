const mongoose = require('mongoose');
const User = require('../models/User');

// Restore is transactional; serializing on the user document fences pre-restore work.
module.exports = async function workflowWrite(user, generation, write) {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const transactional = hello.setName || hello.msg === 'isdbgrid';
  const session = transactional ? await mongoose.startSession() : null;
  const run = async () => {
    const updated = await User.updateOne({ _id: user, $or: [{ dataGeneration: generation || 0 }, ...(generation ? [] : [{ dataGeneration: { $exists: false } }])] },
      { $inc: { workflowWriteVersion: 1 } }, { session });
    if (!updated.matchedCount) {
      const error = new Error('备份恢复后旧任务已失效，请重新生成');
      error.permanent = true; error.publicMessage = error.message; throw error;
    }
    return write(session);
  };
  try {
    if (!session) return await run();
    let result;
    await session.withTransaction(async () => { result = await run(); });
    return result;
  }
  finally { if (session) await session.endSession(); }
};
