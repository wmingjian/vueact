let typeUid = 0;
const types = {};

function _t(type) {
    if (!(type in types)) {
        types[type] = typeUid++;
    }
    return type;
}

function ast2fun(ast, options) {
    function formatProp(prop) {
        const t = typeof prop;
        if (isAtom(t)) {
            if (options.diff) {
                return 0;
            }
            return JSON.stringify(prop);
        } else if (t === 'object') {
            const { type } = prop;
            if (type === _t('expr')) {
                const sb = [];
                prop.nodes.forEach(node => {
                    switch (node.type) {
                        case 'atom':
                            sb.push(JSON.stringify(node.value));
                            break;
                        case 'var':
                            sb.push(node.name);
                            break;
                        case 'exp':
                            sb.push(node.value);
                            break;
                        default:
                            console.error(node);
                            break;
                    }
                });
                return sb.join('+');
            } else if (type === _t('var')) {
                return prop.name;
            }
        }
        return prop;
    }
    function formatProps(props) {
        const sb = [];
        for (const k in props) {
            const v = formatProp(props[k]);
            if (v !== 0) {
                sb.push(k + ':' + v);
            }
        }
        return `{${sb.join(',')}}`;
    }
    function indent(level) {
        return new Array(level + 1).join('  ');
    }
    function f(type) {
        if (options.type) {
            return JSON.stringify(type) + ',';
        }
        return '';
    }
    function ft(tag) {
        if (options.tag) {
            return JSON.stringify(tag) + ',';
        }
        return '';
    }
    function formatNode(node, level) {
        const { id, type, tag, props, children } = node;
        const p = formatProps(props);
        const sb = [`h(${id},${f(type)}${ft(tag)}${p}`];
        const arr = [];
        for (let i = 0, len = children.length; i < len; i++) {
            const s = node2jsx(children[i], level + 1);
            if (s !== 0) {
                arr.push(s);
            }
        }
        if (arr.length) {
            const indent1 = indent(level + 1);
            sb.push(',\n' + indent1 + arr.join(',\n' + indent1));
        }
        sb.push(')');
        if (options.diff && p === '{}' && arr.length === 0) {
            return 0;
        }
        return sb.join('');
    }
    function formatNodes(children, level) {
        const indent1 = indent(level);
        const indent2 = indent(level + 1);
        const a = [];
        for (let i = 0, len = children.length; i < len; i++) {
            const s = node2jsx(children[i], level + 1);
            if (s !== 0) {
                a.push(s);
            }
        }
        const s = `\n${indent2}${a.join(',\n' + indent2)}\n${indent1}`;
        const len = a.length;
        return len === 0 ? '0' : len > 1 ? `[${s}]` : s;
    }
    function formatForNode(node, level) {
        const { id, type, tag, props, children } = node;
        const sb = [`h(${id},${f(type)}${ft(tag)}${formatProps(props)}`];
        const { list, v, i } = node;
        sb.push(`,${list},(${v}${i !== '' ? ',' + i : ''})=>${formatNodes(children, level)}`);
        sb.push(')');
        return sb.join('');
    }
    function formatForEachNode(node, level) {
        const { id, type, tag, props, children } = node;
        const sb = [`h(${id},${f(type)}${ft(tag)}${formatProps(props)}`];
        const { map, v, k } = node;
        sb.push(`,${map},(${v}${k !== '' ? ',' + k : ''})=>${formatNodes(children, level)}`);
        sb.push(')');
        return sb.join('');
    }
    function node2jsx(node, level = 0) {
        if (typeof node === 'string') {
            return JSON.stringify(node);
        }
        const { type } = node;
        if (type === _t('dom') || type === _t('component')) {
            return formatNode(node, level);
        } else if (type === _t('if')) {
            const { id, tag, exp, props, children } = node;
            if (tag === 'if') {
                return `h(${id},${f(type)}${ft(tag)}{exp:${formatProp(exp)}},` // TODO exp会计算两次，可能有副作用
                    + `(e)=>e?${formatNodes(children, level)}:0`
                    + `)`;
            } else {
                return formatNode({ ...node, props: { 'v-if': exp, ...props } }, level);
            }
        } else if (type === _t('for')) {
            const { id, tag, children, list, v, i } = node;
            if (tag === 'for') {
                return `h(${id},${f(type)}${ft(tag)}{},${list},(${v}${i !== '' ? ',' + i : ''})=>${formatNodes(children, level)})`;
            } else {
                return formatForNode(node, level);
            }
        } else if (type === _t('foreach')) {
            const { id, tag, children, map, v, k } = node;
            if (tag === 'foreach') {
                return `h(${id},${f(type)}${ft(tag)}{},${map},(${v}${k !== '' ? ',' + k : ''})=>${formatNodes(children, level)})`;
            } else {
                return formatForEachNode(node, level);
            }
        } else if (type === _t('expr')) {
            const sb = [];
            node.nodes.forEach(n => {
                switch (n.type) {
                    case 'atom':
                        sb.push(JSON.stringify(n.value));
                        break;
                    case 'var':
                        sb.push(n.name);
                        break;
                    case 'exp':
                        sb.push(n.value);
                        break;
                    default:
                        console.log(n);
                        break;
                }
            });
            return sb.join(',\n' + indent(level));
        } else if (type === _t('atom')) {
            if (options.diff) {
                return 0;
            }
            return 'h(' + node.id + ',' + f(node.type) + JSON.stringify(node.value) + ')';
        } else if (type === _t('var')) {
            return 'h(' + node.id + ',' + f(node.type) + node.name + ')';
        } else if (type === _t('exp')) {
            return 'h(' + node.id + ',' + f(node.type) + node.value + ')';
        }
        console.error(node);
        return '';
    }
    return 'with($.props){with($.state){\nreturn ' + node2jsx(ast) + ';\n}}';
}

const parse = xml => {
    function parseExpr(str) {
        const arr = str.split(/\{|\}/);
        const nodes = [];
        let expStart = false;
        for (let i = 0, len = arr.length; i < len; i++) {
            if (i === 0 && arr[0] === '') {
                expStart = true;
                continue;
            }
            let v = arr[i];
            if (v !== '') {
                if (expStart) {
                    if (/^\w+$/.test(v)) {
                        nodes.push({ type: _t('var'), name: v });
                    } else {
                        nodes.push({ type: _t('exp'), value: v }); // TODO
                    }
                } else {
                    nodes.push({ type: _t('atom'), t: 'string', value: trim(v) });
                }
            }
            expStart = !expStart;
        }
        return { id: -1, type: _t('expr'), nodes, text: str };
    }
    function parseProp(value) {
        let v = value, a;
        if (value.charAt(0) === '$') {
            v = { type: _t('var'), name: value.substr(1) };
        } else if (value.indexOf('{') !== -1) {
            if (/^\{\d+\}$/.test(value)) {
                v = parseInt(value.substring(1, value.length - 1), 10);
            } else if (a = /^\{(true|false)\}$/.exec(value)) {
                v = a[1] === 'true';
            } else {
                const expr = parseExpr(value);
                delete expr.id;
                v = expr;
            }
        }
        return v;
    }
    function getType(tag) {
        if (/^[a-z\d]+$/.test(tag)) {
            return _t('dom');
        } else if (/^[A-Z]/.test(tag)) {
            return _t('component');
        }
    }
    function parseVNode(parent, node) {
        switch (node.nodeType) {
            case 1: // ELEMENT_NODE
                const tag = node.tagName;
                const props = {};
                const children = [];
                let vn = { id: -1, type: '', tag, props, children };
                let ifNode;
                const { attributes, childNodes } = node;
                if (attributes.length) {
                    for (let i = 0, len = attributes.length; i < len; i++) {
                        const { nodeName, nodeValue } = attributes[i];
                        if (nodeName === 'v-if') {
                            const exp = nodeValue;
                            ifNode = {
                                id: -1,
                                type: _t('if'),
                                tag: 'if',
                                props: {},
                                children: [vn],
                                exp: parseProp(exp)
                            };
                            add(ifNode);
                            add(vn);
                            vn.type = getType(tag);
                            vn = ifNode;
                        } else {
                            props[nodeName] = nodeValue;
                        }
                    }
                }
                if (!ifNode) {
                    add(vn);
                }
                if (childNodes.length) {
                    for (let i = 0, len = childNodes.length; i < len; i++) {
                        const n = childNodes[i];
                        const x = parseVNode(parent, n);
                        pushChildren(children, x);
                    }
                }
                if (ifNode) {
                } else if (tag === 'if') {
                    vn.type = _t('if');
                    const { exp } = props;
                    delete props.exp;
                    vn.exp = parseProp(exp);
                } else if (tag === 'for') {
                    vn.type = _t('for');
                    const { list } = props;
                    delete props.list;
                    const a = list.substr(1).split(',');
                    vn.list = a[0];
                    vn.v = a[1];
                    vn.i = a.length === 3 ? a[2] : '';
                } else if (tag === 'foreach') {
                    vn.type = _t('foreach');
                    const { map } = props;
                    delete props.map;
                    const a = map.substr(1).split(',');
                    vn.map = a[0];
                    vn.v = a[1];
                    vn.k = a.length === 3 ? a[2] : '';
                } else if ('v-for' in props && (tag === 'ul' || tag === 'ol' || tag === 'dt' || tag === 'div')) {
                    vn.type = _t('for');
                    const { 'v-for': list } = props;
                    delete props['v-for'];
                    const a = list.substr(1).split(',');
                    vn.list = a[0];
                    vn.v = a[1];
                    vn.i = a.length === 3 ? a[2] : '';
                } else if ('v-foreach' in props && (tag === 'ul' || tag === 'ol' || tag === 'dt' || tag === 'div')) {
                    // vn._type = vn.type; // ''
                    vn.type = _t('foreach');
                    const { 'v-foreach': map } = props;
                    delete props['v-foreach'];
                    const a = map.substr(1).split(',');
                    vn.map = a[0];
                    vn.v = a[1];
                    vn.k = a.length === 3 ? a[2] : '';
                } else {
                    vn.type = getType(tag);
                }
                for (const k in props) {
                    props[k] = parseProp(props[k]);
                }
                return vn;
            case 3: // TEXT_NODE
                const text = trim(node.nodeValue);
                if (text !== '') {
                    if (text.indexOf('{') !== -1) {
                        const expr = parseExpr(text);
                        return expr.nodes.map(n => add({ id: -1, ...n }));
                    }
                    return add({ id: -1, type: 'atom', t: 'string', value: text });
                }
                break;
            case 8: // COMMENT_NODE
                break;
            default:
                console.log(node.nodeType);
                break;
        }
    }
    function add(node) {
        node.id = uid('node');
        allNodes.push(node);
        return node;
    }
    function compile(ast, options) {
        const code = ast2fun(ast, options);
        return new Function('h', '$', code);
    }
    const allNodes = [];
    const doc = loadXMLString(xml);
    const ast = parseVNode(null, doc.documentElement);
    // const ss = JSON.stringify(ast);
    return {
        root: ast,
        nodes: allNodes,
        renderDom: compile(ast, { type: true, tag: true }), // 生成完整代码
        renderDiff: compile(ast, { type: false, tag: false, diff: true }) // 生成diff代码
    };
};
