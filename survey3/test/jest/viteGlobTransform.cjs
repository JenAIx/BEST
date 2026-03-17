/**
 * Custom Jest transformer that wraps babel-jest and handles Vite-specific
 * `import.meta.glob(...)` calls by replacing them with Node.js fs-based code
 * BEFORE passing the source to Babel.
 */
const path = require('path');
const babelJest = require('babel-jest');

const defaultTransformer = babelJest.createTransformer();

function replaceImportMetaGlob(code) {
  const projectRoot = path.resolve(__dirname, '../..');

  return code.replace(
    /(const|let|var)\s+(\w+)\s*=\s*import\.meta\.glob\(\s*['"]([^'"]+)['"]\s*(?:,\s*\{[^}]*\})?\s*\)/g,
    (match, decl, varName, globPattern) => {
      const dir = path.join(projectRoot, path.dirname(globPattern)).replace(/\\/g, '/');
      const fileGlob = path.basename(globPattern);
      const fileRegex = fileGlob.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const prefix = path.dirname(globPattern);

      return `${decl} ${varName} = (function() {
  var _fs = require('fs');
  var _path = require('path');
  var _dir = '${dir}';
  var _result = {};
  _fs.readdirSync(_dir).filter(function(f) { return new RegExp('^${fileRegex}$').test(f); }).sort().forEach(function(f) {
    var _data = JSON.parse(_fs.readFileSync(_path.join(_dir, f), 'utf8'));
    _result['${prefix}/' + f] = { default: _data };
  });
  return _result;
})()`;
    }
  );
}

module.exports = {
  process(sourceText, sourcePath, options) {
    const code = replaceImportMetaGlob(sourceText);
    return defaultTransformer.process(code, sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    const code = replaceImportMetaGlob(sourceText);
    return defaultTransformer.getCacheKey(code, sourcePath, options);
  },
};
