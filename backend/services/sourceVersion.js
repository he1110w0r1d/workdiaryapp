const { createHash } = require('crypto');
function sourceVersion(d) {
  return createHash('sha256').update(JSON.stringify([
    String(d._id), String(d.user), d.content, d.location, new Date(d.startTime).toISOString(),
    new Date(d.endTime).toISOString(), d.tags || [], d.workPriority, !!d.isDeleted
  ])).digest('hex');
}
module.exports = sourceVersion;
