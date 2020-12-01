const fs = require('fs');

const files = [
    'src/util.js',
    'src/parse.js',
    'src/expr.js',
    'src/model.js',
    'src/node.js',
    'src/attr.js',
    'src/renderer.js',
    'src/component.js',
    'src/delegate.js',
    'src/core.js'
];
const sb = [];
files.forEach(file => {
    const code = fs.readFileSync(file, 'utf-8');
    sb.push(code);
});
const str = '(function(exports) {'
    + '\n\n' + sb.join('\n').replace(/(\n +)(console\.assert\()/g, '$1// $2')
    + '\n})(this);\n';
fs.writeFileSync('lib/vueact.js', str, 'utf-8');
