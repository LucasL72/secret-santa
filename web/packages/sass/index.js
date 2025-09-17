const fs = require('fs');
const path = require('path');

function compile(options = {}) {
  if (options.data) {
    return { css: Buffer.from(String(options.data)) };
  }

  if (options.file) {
    const filePath = path.resolve(options.file);
    const contents = fs.readFileSync(filePath, 'utf8');
    return { css: Buffer.from(contents) };
  }

  return { css: Buffer.from('') };
}

function render(options, callback) {
  try {
    const result = compile(options);
    if (typeof setImmediate === 'function') {
      setImmediate(() => callback(null, result));
    } else {
      callback(null, result);
    }
  } catch (error) {
    if (typeof setImmediate === 'function') {
      setImmediate(() => callback(error));
    } else {
      callback(error);
    }
  }
}

function renderSync(options) {
  return compile(options);
}

module.exports = {
  render,
  renderSync,
  info: 'Stub Sass compiler for offline development',
  types: {
    Error: Error,
  },
};
