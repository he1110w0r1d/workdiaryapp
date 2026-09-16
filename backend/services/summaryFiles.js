const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const directory = path.join(__dirname, '../private/summaries');
const prefix = '/private/summaries/';

function resolveHTMLFile(value) {
  if (typeof value !== 'string' || !value.startsWith(prefix)) return null;
  const filename = value.slice(prefix.length);
  if (!/^[a-f\d-]{36}\.html$/i.test(filename)) return null;
  return path.join(directory, filename);
}

async function saveHTMLFile(content) {
  await fs.promises.mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.html`;
  await fs.promises.writeFile(path.join(directory, filename), content, { flag: 'wx', mode: 0o600 });
  return `${prefix}${filename}`;
}

module.exports = { saveHTMLFile, resolveHTMLFile };
