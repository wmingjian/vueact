(function(exports) {

function loadXMLString(xmlString) {
    let xmlDoc = null;
    if (!window.DOMParser && window.ActiveXObject) { // window.DOMParser 判断是否是非ie浏览器
        const xmlDomVersions = ['MSXML.2.DOMDocument.6.0', 'MSXML.2.DOMDocument.3.0', 'Microsoft.XMLDOM'];
        for (let i = 0, len = xmlDomVersions.length; i < len; i++) {
            try {
                xmlDoc = new ActiveXObject(xmlDomVersions[i]);
                xmlDoc.async = false;
                xmlDoc.loadXML(xmlString); // loadXML方法载入xml字符串
                break;
            } catch (ex) {
            }
        }
    } else if (window.DOMParser && document.implementation && document.implementation.createDocument) { // 支持Mozilla浏览器
        try {
            domParser = new DOMParser();
            xmlDoc = domParser.parseFromString(xmlString, 'text/xml');
        } catch (ex) {
        }
    } else {
        return null;
    }
    return xmlDoc;
}

const re_var = /\{([\w\.\+\-\*\/%\(\)\= ]+)\}/g;

const uids = {
    node: 0,
    model: 0,
    attr: 0,
    vnode: 0
};
function uid(type) {
    return uids[type]++;
}

function isAtom(t) { // primitive
    return t === 'string' || t === 'number' || t === 'boolean';
}

function trim(str) {
    return str.replace(/^[\s\n]+|[\s\n]+$/g, '');
}

function formatName(name) {
    return name.replace(/(^|_)([a-z])/g, (_, a, b) => b.toUpperCase());
}

function unshiftChildren(children, c) {
    if (c) {
        if (c instanceof Array) {
            for (let i = c.length - 1; i > 0; i--) {
                children.unshift(c[i]);
            }
        } else {
            children.unshift(c);
        }
    }
}

function pushChildren(children, c) {
    if (c) {
        if (c instanceof Array) {
            c.forEach(v => children.push(v));
        } else {
            children.push(c);
        }
    }
}

function unshiftElements(parent, el) {
    if (el) {
        const ref = parent.firstChild;
        if (el instanceof Array) {
            if (ref) {
                el.forEach(v => parent.insertBefore(v, ref));
            } else {
                el.forEach(v => parent.appendChild(v));
            }
        } else {
            if (ref) {
                parent.insertBefore(el, ref);
            } else {
                parent.appendChild(el);
            }
        }
    }
}

function pushElements(parent, el) {
    if (el) {
        if (el instanceof Array) {
            el.forEach(v => parent.appendChild(v));
        } else {
            parent.appendChild(el);
        }
    }
}

function setAttr(el, k, v) {
    if (k === 'style') {
        el.style.cssText = v;
    } else if (k === 'disabled' || k === 'readonly' || k === 'checked' || k === 'selected') {
        if (typeof v === 'boolean') {
            if (v) {
                el.setAttribute(k, k);
            } else {
                el.removeAttribute(k);
            }
        } else {
            console.error(v);
        }
    } else {
        if (v === null) {
            el.removeAttribute(k);
        } else {
            el.setAttribute(k, v);
        }
    }
}

// 以下代码参考 vue 2.x
const inBrowser = typeof window !== 'undefined';
const inWeex = typeof WXEnvironment !== 'undefined' && !!WXEnvironment.platform;
const weexPlatform = inWeex && WXEnvironment.platform.toLowerCase();
const UA = inBrowser && window.navigator.userAgent.toLowerCase();
const isIE = UA && /msie|trident/.test(UA);
const isIOS = (UA && /iphone|ipad|ipod|ios/.test(UA)) || (weexPlatform === 'ios');

function isNative(C) {
    return typeof C === 'function' && /native code/.test(C.toString());
}

let isUsingMicroTask = false;

const callbacks = [];
let pending = false;

function flushCallbacks() {
    pending = false;
    const copies = callbacks.slice(0);
    callbacks.length = 0;
    for (let i = 0, len = copies.length; i < len; i++) {
        copies[i]();
    }
}

let timerFunc;

if (typeof Promise !== 'undefined' && isNative(Promise)) {
    const p = Promise.resolve();
    timerFunc = () => {
        p.then(flushCallbacks);
        if (isIOS) {
            setTimeout(noop);
        }
    };
    isUsingMicroTask = true;
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
    isNative(MutationObserver) ||
    MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
    let counter = 1;
    const observer = new MutationObserver(flushCallbacks);
    const textNode = document.createTextNode(String(counter));
    observer.observe(textNode, {
        characterData: true
    });
    timerFunc = () => {
        counter = (counter + 1) % 2;
        textNode.data = String(counter);
    };
    isUsingMicroTask = true;
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
    timerFunc = () => {
        setImmediate(flushCallbacks);
    };
} else {
    timerFunc = () => {
        setTimeout(flushCallbacks, 0);
    };
}

function nextTick(cb, ctx) {
    let _resolve;
    callbacks.push(() => {
        if (cb) {
            try {
                cb.call(ctx);
            } catch (ex) {
                console.log(ex, ctx, 'nextTick');
            }
        } else if (_resolve) {
            _resolve(ctx);
        }
    });
    if (!pending) {
        pending = true;
        timerFunc();
    }
    if (!cb && typeof Promise !== 'undefined') {
        return new Promise((resolve) => {
            _resolve = resolve;
        });
    }
}

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

class Expr {
    constructor(model, text) {
        this.model = model;
        this.text = text;
        this.deps = {};
    }
    addDep(name) {
        if (!(name in this.deps)) {
            this.deps[name] = 1;
        } else {
            this.deps[name]++;
        }
    }
    // TODO 改为真正的语法解析
    compile(code) {
        let s = code.replace(re_var, (_, name) => {
            if (/^\w+$/.test(name)) {
                this.addDep(name);
                return '" + ' + name + ' + "';
            } else { // name是一个表达式
                name.replace(/(\w+)/g, (_, n) => {
                    if (!/^\d+$/.test(n)) {
                        this.addDep(n);
                    }
                });
                return '" + (' + name + ') + "';
            }
        });
        if (code.charAt(0) === '{') {
            s = s.replace(/^\" \+ /, '');
        } else {
            s = '"' + s;
        }
        if (code.charAt(code.length - 1) === '}') {
            s = s.replace(/ \+ \"$/, '');
        } else {
            s = s + '"';
        }
        s = s.replace(/\n/g, '\\n');
        s = 'with(__scope){return ' + s + ';};'
        return new Function('__scope', s);
    }
    evaluate(vnode) {
        const scope = {};
        for (const k in vnode.model.depsAll) {
            const a = k.split('#');
            scope[a[1]] = vnode.getVar(a[1]);
        }
        return this.func(scope);
    }
}

const expr = {
    parse(model, text) {
        return new Expr(model, text);
    }
};

class Model {
    constructor(proto, parent, node) {
        this.__node = node;
        this.id = uid('model');
        proto.models[this.id] = this;
        this.proto = proto; // 所属组件{ComponentProto}
        this.parent = parent; // 所属父Node
        this.type = '';
        this.deps = {}; // 依赖的变量：state,props,local,unknown(expr)
        this.depsAll = {};
    }
    addDep(type, name) {
        const key = type + '#' + name;
        if (!(key in this.deps)) {
            this.deps[key] = true;
            this.depsAll[key] = true;
        }
    }
    addDepAll(type, name) {
        const key = type + '#' + name;
        if (!(key in this.depsAll)) {
            this.depsAll[key] = true;
        }
    }
    getVarObj(name) {
        for (let p = this.parent; p; p = p.parent) {
            if (p.scope && name in p.scope) {
                return {
                    value: p.scope[name],
                    type: 'local'
                };
            }
        }
        const { c } = this.proto;
        if (name in c.state) {
            return { type: 'state', value: c.state[name] };
        } else if (name in c.props) {
            return { type: 'props', value: c.props[name] };
        } else {
            return { type: 'unknown', value: undefined };
        }
    }
    createVNode(data) {
        const C = vueact.nodeMap[this.type];
        const vnode = new C(this, data);
        return vnode;
    }
    buildChildren(parent, node) {
        const { children } = node;
        const nodes = [];
        for (let i = 0, len = children.length; i < len; i++) {
            const n = children[i];
            const vn = this.proto.parseVNode(parent, n);
            if (vn) {
                nodes.push(vn);
            }
        }
        return nodes;
    }
}

class AtomModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'atom';
        this.t = node.t || typeof node.value;
        this.value = node.value;
    }
}

class ExprModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'expr';
        this.expr = expr.parse(this, node.text); // {Expr}
        for (const k in this.expr.deps) {
            const v = this.getVarObj(k);
            this.addDep(v.type, k);
        }
    }
}

class VarModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'var';
        const { name } = node;
        this.name = name;
        const v = this.getVarObj(name);
        this.addDep(v.type, name);
    }
}

class ExpModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'exp';
        this.value = node.value;
    }
}

class BlockModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        // TODO
    }
}

class IfModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'if';
        const { type, tag, props, exp } = node;
        this.tag = tag;
        this.expr = expr.parse(this, exp.text); // {Expr}
        for (const k in this.expr.deps) {
            const v = this.getVarObj(k);
            this.addDep(v.type, k);
        }
        this.attrs = this.proto.parseAttrs(this, props);
        this.nodes = this.buildChildren(this, node);
    }
}

class DomModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'dom';
        this.__node = node;
        const { tag, props } = node;
        this.tag = tag; // TODO 检查tag合法性
        this.attrs = this.proto.parseAttrs(this, props);
        this.nodes = this.buildChildren(this, node);
    }
}

class ForModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'for';
        const name = this.name = node.list;
        const v = this.getVarObj(name);
        this.addDep(v.type, name);
        const props = { ...node.props };
        this.attrs = props;
        this.nodes = this.buildChildren(this, node);
    }
}

class ForEachModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'foreach';
        const name = this.name = node.map;
        const v = this.getVarObj(name);
        this.addDep(v.type, name);
        const props = { ...node.props };
        this.attrs = props;
        this.nodes = this.buildChildren(this, node);
    }
}

class ListModel extends ForModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'list';
        this.tag = node.tag;
    }
}

class MapModel extends ForEachModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'map';
        this.tag = node.tag;
    }
}

class ComponentModel extends DomModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'component';
    }
}

class FragmentModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'fragment';
    }
}

class VNode {
    constructor(model, data) {
        const { id, proto, type, tag } = model;
        this.mid = id;
        this.id = uid('vnode');
        this.proto = proto; // {ComponentProto}
        this.model = model; // {Model}
        this.data = data;
        this.type = type;
        this.el = null; // {Element}
        if (!(type === _t('if') && tag !== 'if')) {
            for (const k in model.deps) { // 根据model的deps添加
                this.proto.addRef(k, this);
            }
        }
    }
    dispose() {
        this.el = null;
        this.model = null;
        this.proto = null;
    }
    get doc() {
        return this.model.proto.ctx.document;
    }
    getComponent(tag) {
        const { components } = this.model.proto.ctx;
        return components[tag];
    }
    renderNode() {
        // TODO el赋值方式有待改进
        return this.el = this.render(); // model实例化为dom node
    }
    render() {
        return null;
    }
    update() {
        console.log('update', this);
    }
    remove() {
        this.el.parentNode.removeChild(this.el);
    }
}

class AtomNode extends VNode {
    constructor(model, data) {
        super(model, data);
        this.value = model.value;
    }
    render() {
        return this.el || this.doc.createTextNode(this.value);
    }
    update(value) {
        // empty
    }
}

class ExprNode extends VNode {
    constructor(model, data) {
        super(model, data);
    }
    render() {
        const text = this.model.expr.evaluate(this);
        if (this.el) {
            this.el.textContent = text;
            return this.el;
        } else {
            return this.doc.createTextNode(text);
        }
    }
}

class VarNode extends VNode {
    constructor(model, data) {
        super(model, data);
        this.value = data ? data.value : undefined;
    }
    render() {
        const v = this.value;
        if (this.el) {
            this.el.textContent = v;
            return this.el;
        } else {
            return this.doc.createTextNode(v);
        }
    }
    update(value) {
        if (this.value !== value) {
            this.value = value;
            this.el.textContent = value;
        }
    }
}

class ExpNode extends VNode {
    constructor(model, data) {
        super(model, data);
        this.value = data.value;
    }
    render() {
        return this.el || this.doc.createTextNode(this.value);
    }
    update(value) {
        if (this.value !== value) {
            this.value = value;
            this.el.textContent = value;
        }
    }
}

class BlockNode extends VNode {
    constructor(model, data) {
        super(model, data);
        this.holder = null; // 占位符
    }
    render() {
        return null;
    }
    getHolder() {
        return this.holder || (this.holder = this.doc.createComment(this.tag + ' ' + this.id));
    }
}

class IfNode extends BlockNode {
    constructor(model, data) {
        super(model, data);
        this.children = [];
        this.ret = false;
        this.oldRet = null;
        for (const k in model.expr.deps) {
            const v = model.getVarObj(k);
            model.addDep(v.type, k);
            this.proto.addRef(v.type + '#' + k, this);
        }
        this.elements = [];
        this.container = null;
        this.fullFunc = null;
        this.block_t = null; // {Block}
        this.block_f = null; // {Block}
    }
    render() {
        const { doc, elements, children } = this;
        const exp = this.data.props.exp;
        this.oldRet = this.ret;
        this.ret = !!exp;
        let container = this.ret
            ? this.container || (this.container = doc.createDocumentFragment())
            : this.getHolder();
        if (exp) {
            if (elements.length === 0) {
                for (let i = 0, len = children.length; i < len; i++) {
                    const child = children[i];
                    if (child) {
                        pushChildren(elements, child.renderNode());
                    }
                }
            }
            if (this.ret !== this.oldRet) {
                if (this.el) {
                    const p = this.el.parentNode;
                    elements.forEach((el, i) => {
                        p.insertBefore(el, this.el);
                    });
                    p.removeChild(this.el);
                }
            }
            // TODO DOM操作性能有待提升
            elements.forEach(el => {
                container.appendChild(el);
            });
            return container; // elements;
        } else {
            if (this.ret !== this.oldRet) {
                const ref = elements[0];
                const p = ref.parentNode;
                p.replaceChild(container, ref);
                elements.forEach((el, i) => {
                    if (i !== 0) {
                        p.removeChild(el);
                    }
                });
            }
            return container;
        }
    }
    renderCond(renderer, props, func) {
        const { exp } = props;
        let f = func;
        renderer.openBlock(!!exp
            ? this.block_t || (f = this.fullFunc || (this.fullFunc = func), this.block_t = new Block())
            : this.block_f || (f = this.fullFunc || (this.fullFunc = func), this.block_f = new Block())
        );
        const vn = f(exp);
        renderer.closeBlock();
        return vn;
    }
    create(renderer, props, func) {
        const c = this.renderCond(renderer, props, func);
        pushChildren(this.children, c);
    }
    update(renderer, props, func) {
        const c = this.renderCond(renderer, props, func);
        this._update(props, [c]);
    }
    _update(props, children) {
        this.oldRet = this.ret;
        this.ret = !!props.exp;
        if (this.ret !== this.oldRet) {
            const { elements } = this;
            if (this.ret) {
                if (elements.length === 0) {
                    for (let i = 0, len = children.length; i < len; i++) {
                        const child = children[i];
                        if (child) {
                            pushChildren(elements, child.renderNode());
                        }
                    }
                }
                const { el } = this;
                if (el) {
                    const ref = this.container === el ? this.holder : el;
                    const p = ref.parentNode;
                    elements.forEach(v => {
                        p.insertBefore(v, ref);
                    });
                    p.removeChild(ref);
                }
            } else {
                const ref = elements[0];
                const p = ref.parentNode;
                p.replaceChild(this.getHolder(), ref);
                elements.forEach((el, i) => {
                    if (i !== 0) {
                        p.removeChild(el);
                    }
                });
            }
        }
    }
}

class DomNode extends VNode {
    constructor(model, data) {
        super(model, data);
        const { tag, attrs } = model;
        this.tag = tag; // TODO 检查tag合法性
        const props = {};
        for (const k in attrs) {
            const attr = attrs[k];
            if (typeof attr === 'string') {
                props[k] = attr;
            } else if (attr instanceof AttrNode) {
                attr.setNode(this);
                attr.attrName = k;
                props[k] = k in data.props ? data.props[k] : attr.getValue(this);
            }
        }
        this.props = props;
        this.children = [];
        this.attributes = {}; // 可变 attributes
    }
    render() {
        const { children } = this;
        const { proto, attrs } = this.model;
        const el = this.el || this.doc.createElement(this.tag);
        if (attrs) { // TODO
            for (const k in attrs) {
                const attr = attrs[k];
                const t = typeof attr;
                if (isAtom(t)) {
                    setAttr(el, k, attr);
                } else if (attr instanceof AttrNode) {
                    let at = attr.attrType;
                    if (at === 'action') {
                        proto.addAction(this.model, attr.action, el);
                    } else {
                        setAttr(el, k, this.props[k]);
                        const domAttr = el.attributes[k];
                        attr.setAttr(domAttr);
                        if (at !== 'string') {
                            this.attributes[k] = domAttr;
                        }
                    }
                }
            }
        }
        if (children) {
            for (let i = 0, len = children.length; i < len; i++) {
                let child = children[i];
                if (child) {
                    pushElements(el, child.renderNode());
                }
            }
        }
        return el;
    }
    update(props/* , children */) {
        for (const k in props) {
            setAttr(this.el, k, props[k]);
        }
    }
}

class ForNode extends BlockNode {
    constructor(model, data) {
        super(model, data);
        const { __node, attrs } = model;
        this.name = __node.list;
        this.props = { ...attrs };
        this.children = [];
        this.blocks = []; // [{Block}]
        this.nodeList = [];
    }
    createBlock(renderer, func, value, idx) {
        const block = renderer.openBlock();
        const c = (this.fullFunc || func)(value, idx);
        renderer.closeBlock();
        return { block, c };
    }
    render() {
        if (this.children.length !== 0) {
            const fragment = this.el || this.doc.createDocumentFragment();
            this.children.forEach(c => {
                const el = c.renderNode();
                pushElements(fragment, el);
            });
            return fragment;
        } else {
            return this.getHolder();
        }
    }
    renderAll(renderer, list, func) {
        if (!this.fullFunc) {
            this.fullFunc = func;
        }
        list.forEach((v, i) => {
            const { block, c } = this.createBlock(renderer, func, v, i);
            this.blocks.push(block);
            this.nodeList.push(c);
            pushChildren(this.children, c);
        });
    }
    compare(arr, cb) {
        // 使用proxy观察数组变化，省掉数组diff逻辑
        arr.$delegate.exec(cb, this.model.__node.i !== ''); // 数组变更的diff数据
    }
    removeNode(c) {
        const { blocks } = this;
        if (blocks.length === 1) {
            const ref = c instanceof Array ? c[0].el : c.el;
            ref.parentNode.insertBefore(this.getHolder(), ref);
        }
        if (c instanceof Array) {
            c.forEach(v => v.remove());
        } else {
            c.remove();
        }
    }
    renderDiff(renderer, list, func) {
        const { children, nodeList, blocks, holder } = this;
        let n0;
        const { parentNode } = nodeList.length === 0 // 如果删空了，会找不到parentNode
            ? holder
            : (
                n0 = nodeList[0],
                n0 instanceof Array ? n0[0].el : n0.el
            );
        this.compare(list, {
            unshift: (value) => {
                const { block, c } = this.createBlock(renderer, func, value, 0);
                const len = nodeList.length;
                blocks.unshift(block);
                nodeList.unshift(c);
                if (len === 0) {
                    parentNode.removeChild(holder);
                }
                unshiftChildren(children, c);
                unshiftElements(parentNode, c instanceof Array ? c.map(v => v.renderNode()) : c.renderNode());
            },
            push: (value) => {
                const { block, c } = this.createBlock(renderer, func, value, nodeList.length);
                const len = nodeList.length;
                blocks.push(block);
                nodeList.push(c);
                if (len === 0) {
                    parentNode.removeChild(holder);
                }
                pushChildren(children, c);
                pushElements(parentNode, c instanceof Array ? c.map(v => v.renderNode()) : c.renderNode());
            },
            add: ({ idx, value }) => { // v, i, act
                const { block, c } = this.createBlock(renderer, func, value, idx);
                const len = nodeList.length;
                blocks.push(block); // TODO
                nodeList.push(c);
                if (len === 0) {
                    parentNode.removeChild(holder);
                }
                pushChildren(children, c);
                pushElements(parentNode, c instanceof Array ? c.map(v => v.renderNode()) : c.renderNode());
            },
            mod: ({ idx, value }) => { // TODO
                renderer.openBlock(blocks[idx]);
                func(value, idx);
                renderer.closeBlock();
            },
            shift: () => {
                const c = nodeList.shift();
                this.removeNode(c);
                blocks.shift();
                // TODO 更新children
            },
            pop: () => {
                const c = nodeList.pop();
                this.removeNode(c);
                blocks.pop();
                // TODO 更新children
            },
            // splice
            del: ({ idx }) => { // TODO
                const c = nodeList.splice(idx, 1)[0];
                this.removeNode(c);
                blocks.splice(idx, 1);
                // TODO 更新children
            }
        });
    }
    update(renderer, list, func) {
        this.renderDiff(renderer, list, func);
    }
}

class ListNode extends ForNode {
    constructor(model, data) {
        super(model, data);
        this.tag = model.tag;
    }
    render() {
        const el = this.el || this.doc.createElement(this.tag);
        if (this.children.length !== 0) {
            this.children.forEach(c => {
                pushElements(el, c.renderNode());
            });
        } else {
            pushElements(el, this.getHolder());
        }
        return el;
    }
}

class ForEachNode extends BlockNode {
    constructor(model, data) {
        super(model, data);
        const { __node, attrs } = model;
        this.name = __node.list;
        this.props = { ...attrs };
        this.children = [];
        this.blocks = {}; // [{Block}]
        this.nodeList = [];
    }
    createBlock(renderer, func, value, key) {
        const block = renderer.openBlock();
        const c = (this.fullFunc || func)(value, key);
        renderer.closeBlock();
        return { block, c };
    }
    render() {
        if (this.children.length !== 0) {
            const fragment = this.el || this.doc.createDocumentFragment();
            this.children.forEach((c, i) => {
                const el = c.renderNode();
                el.setAttribute('__id', i);
                pushElements(fragment, el);
            });
            return fragment;
        } else {
            return this.getHolder();
        }
    }
    renderAll(renderer, map, func) {
        if (!this.fullFunc) {
            this.fullFunc = func;
        }
        for (const k in map) {
            const { block, c } = this.createBlock(renderer, func, map[k], k);
            this.blocks[k] = block;
            this.nodeList.push(c);
            pushChildren(this.children, c);
        }
    }
    compare(obj, cb) {
        // 使用proxy观察对象变化，省掉对象diff逻辑
        obj.$delegate.exec(cb, this.model.__node.i !== ''); // 对象变更的diff数据
    }
    removeNode(c) {
        const { blocks } = this;
        if (blocks.length === 1) {
            const ref = c instanceof Array ? c[0].el : c.el;
            ref.parentNode.insertBefore(this.getHolder(), ref);
        }
        if (c instanceof Array) {
            c.forEach(v => v.remove());
        } else {
            c.remove();
        }
    }
    renderDiff(renderer, map, func) {
        const { children, nodeList, blocks, holder } = this;
        let n0;
        const { parentNode } = nodeList.length === 0 // 如果删空了，会找不到parentNode
            ? holder
            : (
                n0 = nodeList[0],
                n0 instanceof Array ? n0[0].el : n0.el
            );
        this.compare(map, {
            add: (k, value) => {
                const { block, c } = this.createBlock(renderer, func, value, k);
                const len = nodeList.length;
                blocks[k] = block;
                nodeList.push(c);
                if (len === 0) {
                    parentNode.removeChild(holder);
                }
                pushChildren(children, c);
                pushElements(parentNode, c instanceof Array ? c.map(v => v.renderNode()) : c.renderNode());
            },
            mod: (k, value) => {
                renderer.openBlock(blocks[k]);
                func(value, k);
                renderer.closeBlock();
            },
            del: (k, idx) => {
                let c;
                if (idx === 0) {
                    c = nodeList.shift();
                } else if (idx === nodeList.length - 1) {
                    c = nodeList.pop();
                } else {
                    c = nodeList.splice(idx, 1);
                }
                delete blocks[k];
                this.removeNode(c);
                // TODO 更新children
            }
        });
    }
    update(renderer, map, func) {
        this.renderDiff(renderer, map, func);
    }
}

class MapNode extends ForEachNode {
    constructor(model, data) {
        super(model, data);
        this.tag = model.tag;
    }
    render() {
        const el = this.el || this.doc.createElement(this.tag);
        if (this.children.length !== 0) {
            this.children.forEach(c => {
                pushElements(el, c.renderNode());
            });
        } else {
            pushElements(el, this.getHolder());
        }
        return el;
    }
}

class ComponentNode extends DomNode {
    constructor(model, data) {
        super(model, data);
        this.c = null;
        this.cp = null;
    }
    render() {
        const { proto } = this.model;
        if (!this.c) {
            const C = this.getComponent(this.tag);
            this.cp = proto.ctx.createComponentProto(C, this.props);
            this.c = this.cp.c;
        }
        return this.el || this.cp.render();
    }
    update(props/* , children */) {
        if (this.c.props !== props) {
            this.c.onPropsChange(props);
        } else {
            console.log('ComponentNode::update', props);
        }
    }
}

class FragmentNode extends VNode {
    constructor(model) {
        super(model);
    }
    render() {
        return null;
    }
}

class AttrNode { // TODO extends VNode
    constructor(model) {
        this.id = uid('attr');
        this.componentProto = model.proto; // {ComponentProto}
        this.model = model;
        this.attrType = '';
        this.attrName = '';
        this.node = null;
        this.attr = null; // Dom Attr
    }
    setNode(v) {
        this.node = v;
    }
    setAttr(v) {
        this.attr = v;
    }
    getValue() {
        return '';
    }
    renderAttr() {
    }
}

class StringAttr extends AttrNode {
    constructor(model, value) {
        super(model);
        this.attrType = 'string';
        this.value = value;
    }
    getValue() {
        return this.value;
    }
}

class ActionAttr extends AttrNode {
    constructor(model, action) {
        super(model);
        this.attrType = 'action';
        this.action = action;
    }
    getValue() {
        return this.action;
    }
}

class VarAttr extends AttrNode {
    constructor(model, value) {
        super(model);
        this.attrType = 'var';
        const name = value.name;
        this.name = name;
        this._value = value;
        const v = model.getVarObj(name);
        model.addDepAll(v.type, name); // TODO
        this.componentProto.addRef(v.type + '#' + name, this);
        this.varType = v.type; // props,state,local,unknown
    }
}

class ExprAttr extends AttrNode {
    constructor(model, value) {
        super(model, value);
        this.attrType = 'expr';
        this.expr = expr.parse(model, value.text); // {Expr}
        for (const k in this.expr.deps) {
            const v = model.getVarObj(k);
            model.addDepAll(v.type, k); // TODO
            this.componentProto.addRef(v.type + '#' + k, this);
        }
    }
    getValue(vnode) {
        return this.expr.evaluate(vnode);
    }
    renderAttr() {
        const v = this.getValue(this.node);
        this.node.el.setAttribute(this.attr.nodeName, v);
    }
}

let buid = 0;

class Block {
    constructor() {
        this.id = buid++;
        this.all = {};
        this.refs = {};
    }
    add(node) {
        const { model } = node;
        const { id } = model;
        if (!(id in this.all)) {
            this.all[id] = node;
        } else {
            if (this.all[id] !== node) {
                console.error('node error:', this.all[id], node);
            }
        }
    }
    addRef(name, node) {
        if (!(name in this.refs)) {
            this.refs[name] = [];
        }
        this.refs[name].push(node);
    }
}

class Renderer {
    constructor(component) {
        this.component = component;
        this.models = component.models;
        this.blockStack = [];
        this.block = null;
    }
    openBlock(v) {
        const block = this.block = v || new Block();
        this.blockStack.push(block);
        return block;
    }
    closeBlock() {
        const stack = this.blockStack;
        stack.pop();
        const len = stack.length;
        return this.block = len > 0 ? stack[len - 1] : null;
    }
    getBlock() {
        const { vnode } = this.component;
        if (vnode) {
            return vnode.block || (vnode.block = new Block());
        }
        return new Block();
    }
    run_update(func, data) {
        const { models } = this;
        this.openBlock(this.getBlock());
        const vnode = func((id, ...argv) => {
            const model = models[id];
            let vn = this.block.all[id];
            if (vn) {
                switch (model.type) {
                    case 'atom':
                        vn.update(argv[0]);
                        break;
                    case 'var':
                    case 'exp':
                        vn.update(argv[0]);
                        break;
                    case 'if':
                        const [props, func] = argv;
                        vn.update(this, props, func);
                        break;
                    case 'for':
                    case 'list':
                    case 'foreach':
                    case 'map':
                        vn.update(this, argv[1], argv[2]);
                        break;
                    case 'dom':
                    case 'component':
                        vn.update(argv[0], argv.slice(1));
                        break;
                    default:
                        console.error('model type error:', id);
                        break;
                }
            } else {
                const { type, tag } = model;
                switch (type) {
                    case 'atom':
                        vn = this.render_atom(model, id, type, ...argv);
                        break;
                    case 'var':
                    case 'exp':
                        vn = this.render_var(model, id, type, ...argv);
                        break;
                    case 'if':
                        vn = this.render_if(model, id, type, tag, ...argv);
                        break;
                    case 'for':
                    case 'list':
                    case 'foreach':
                    case 'map':
                        vn = this.render_for(model, id, type, tag, ...argv);
                        break;
                    case 'dom':
                    case 'component':
                        vn = this.render_dom(model, id, type, tag, ...argv);
                        break;
                    default:
                        console.error('model type error:', id);
                        break;
                }
                if (vn) {
                    this.block.add(vn);
                }
            }
            return vn;
        }, data);
        this.closeBlock();
        return vnode;
    }
    run_render(func, data) {
        this.openBlock(this.getBlock());
        const vnode = func((id, type, ...argv) => {
            const model = this.models[id];
            let vn;
            switch (type) {
                case 'atom':
                    vn = this.render_atom(model, id, type, ...argv);
                    break;
                case 'var':
                case 'exp':
                    vn = this.render_var(model, id, type, ...argv);
                    break;
                case 'if':
                    vn = this.render_if(model, id, type, ...argv);
                    break;
                case 'for':
                case 'list':
                case 'foreach':
                case 'map':
                    vn = this.render_for(model, id, type, ...argv);
                    break;
                case 'dom':
                case 'component':
                    vn = this.render_dom(model, id, type, ...argv);
                    break;
                default:
                    console.error('model type error:', id);
                    break;
            }
            if (vn) {
                this.block.add(vn);
            }
            return vn;
        }, data);
        vnode.block = this.block;
        this.closeBlock();
        return vnode;
    }
    render_atom(model, id, type, value) {
        const { all } = this.block;
        let vnode;
        if (id in all) {
            vnode = all[id];
            vnode.update(value);
        } else {
            vnode = model.createVNode({ id, value });
        }
        return vnode;
    }
    render_var(model, id, type, value) {
        const { __node } = model;
        const { all } = this.block;
        let vnode;
        if (id in all) {
            vnode = all[id];
            vnode.update(value);
        } else {
            vnode = model.createVNode({ value });
            if (type === _t('var')) {
                this.block.addRef(__node.name, vnode);
            } else if (type === _t('exp')) {
                __node.value.replace(/(\w+)/g, (_0, name) => {
                    this.block.addRef(name, vnode);
                });
            }
        }
        return vnode;
    }
    render_if(model, id, type, tag, props, func) {
        const { all } = this.block;
        let vnode;
        if (id in all) {
            vnode = all[id];
            vnode.update(this, props, func);
        } else {
            vnode = model.createVNode({ props, func });
            vnode.create(this, props, func);
        }
        return vnode;
    }
    render_for(model, id, type, tag, props, list_map, func) {
        const { all } = this.block;
        let vnode;
        if (id in all) {
            vnode = all[id];
            vnode.update(this, list_map, func);
        } else {
            vnode = model.createVNode(type === 'for'
                ? { props, list: list_map }
                : { props, map: list_map }
            );
            vnode.renderAll(this, list_map, func);
        }
        return vnode;
    }
    render_dom(model, id, type, tag, props, ...children) {
        const { all } = this.block;
        let vnode;
        if (id in all) {
            vnode = all[id];
            vnode.update(props, children);
        } else {
            vnode = model.createVNode({ props, children });
            for (const k in model.attrs) {
                const v = model.attrs[k];
                const t = typeof v;
                if (isAtom(t)) {
                } else if (v instanceof VarAttr) {
                    this.block.addRef(v.name, v);
                } else if (v instanceof ExprAttr) {
                    for (const key in v.expr.deps) {
                        this.block.addRef(key, v);
                    }
                } else if (v instanceof ActionAttr) {
                    if (typeof v.action === 'string') {
                    } else if (v.action.type === 'var') {
                        this.block.addRef(v.action.name, v);
                    }
                } else {
                    console.log(k, v);
                }
            }
            children.forEach(c => {
                pushChildren(vnode.children, c);
            });
        }
        return vnode;
    }
}

class Component {
    constructor(props = {}) {
        this.props = props;
        this.state = {};
    }
    setState(state, cb) {
        // empty
    }
    render() {
        return '';
    }
}

class ComponentProto {
    constructor(ctx, c, tpl) {
        this.ctx = ctx;
        this.c = c; // 组件实例
        this.actions = {}; // 支持action工作机制，简化事件绑定
        this.refs = {}; // 引用组件props或state的VNode实例
        this.models = {};
        this.ast = null;
        this.model = this.buildModel(tpl); // {Model}
        this.renderer = new Renderer(this);
        this.func = this.ast.renderDom;
        this.vnode = null; // {VNode}
        this.allNodes = {};
    }
    dispose() {
        this.vnode = null;
        this.model = null;
        for (const k in this.actions) {
            delete this.actions[k];
        }
        this.c = null;
        this.ctx = null;
    }
    buildModel(tpl) {
        const ast = this.ast = parse(tpl);
        const root = ast.root;
        return this.parseVNode(null, root);
    }
    parseAttrs(model, attrs) {
        for (const k in attrs) {
            const value = attrs[k];
            const t = typeof value;
            let C;
            if (k === '_action') {
                C = ActionAttr;
            } else {
                if (isAtom(t)) {
                } else if (value.type === _t('var')) { // /^\$\w+$/.test(value)
                    C = VarAttr;
                } else if (value.type === _t('expr')) { // indexOf('{') !== -1
                    C = ExprAttr;
                }
            }
            attrs[k] = C ? new C(model, value) : value;
        }
        return attrs;
    }
    parseVNode(parent, node) {
        let model = null;
        const t = typeof node;
        if (isAtom(t)) {
            model = new AtomModel(this, parent, node, t);
        } else if (t === 'object') {
            const type = node.type === _t('for') && node.tag !== 'for'
                ? 'list'
                : node.type === _t('foreach') && node.tag !== 'foreach'
                    ? 'map'
                    : node.type;
            if (type in vueact.modelMap) {
                const C = vueact.modelMap[type];
                model = new C(this, parent, node);
            } else {
                console.error('type error:', type);
            }
        }
        return model;
    }
    addAction(model, act, el) {
        const action = typeof act === 'string' ? act : act.name;
        el.onclick = () => {
            const name = 'handle' + formatName(action); // act.charAt(0).toUpperCase() + act.substr(1)
            if (name in this.c) {
                this.c[name](action, el);
            }
            return false;
        };
        this.actions[action] = { model, el };
    }
    addRef(key, vnode) {
        if (!(key in this.refs)) {
            this.refs[key] = [];
        }
        this.refs[key].push(vnode);
    }
    render() {
        const { props, state } = this.c;
        if (!this.vnode) {
            this.vnode = this.renderer.run_render(this.func, { props, state });
            return this.vnode.renderNode();
        } else {
            this.renderer.run_update(this.ast.renderDiff, { props, state });
            return this.vnode.el;
        }
    }
    update(props) {
        const hash = this.c.props;
        for (const k in props) {
            hash[k] = props[k]; // TODO 数组或对象考虑使用proxy监听变化
        }
        this.render();
    }
    updateDom(newState, oldState, state, cb) {
        this.c.state = newState;
        this.ctx.addTask({
            cp: this,
            c: this.c,
            state: newState,
            cb
        });
    }
    resetState() {
        const { state } = this.c;
        for (const k in state) {
            const v = state[k];
            if (v instanceof Array || v instanceof Object && v !== null) {
                v.$delegate.clear();
            }
        }
    }
}

const arrProps = {
    length: 0,
    push: 1,
    pop: 1,
    unshift: 1,
    shift: 1,
    constructor: 0,
    slice: 0,
    forEach: 0
};

class ArrayDelegate {
    constructor(arr) {
        this.arr = arr;
        const len = arr.length;
        this.list = new Array(len); // emulate arr
        this.len = len; // 数组更新前的长度
        this.queue = []; // diff数据
        this._cleared = false;
    }
    add(v) {
        this._cleared = false;
        this.queue.push(v);
    }
    exec(cb, hasIdx) {
        let n = this.len;
        const { arr, list } = this;
        list.length = n;
        for (let i = 0; i < n; i++) {
            list[i] = i;
        }
        let updateIdx = '';
        this.queue.forEach(v => {
            const { key } = v;
            if (typeof key === 'number') {
                cb.mod({ idx: key, old: v.old, value: v.value });
            } else {
                switch (key) {
                    case 'unshift':
                        cb.unshift(v.argv[0]);
                        n++;
                        list.unshift('unshift');
                        updateIdx = 'unshift';
                        break;
                    case 'push':
                        cb.push(v.argv[0]);
                        n++;
                        list.push('push');
                        break;
                    case 'shift':
                        cb.shift();
                        n--;
                        list.shift();
                        updateIdx = 'shift';
                        break;
                    case 'pop':
                        cb.pop();
                        n--;
                        list.pop();
                        break;
                }
            }
        });
        if (hasIdx && updateIdx !== '') {
            list.forEach((n, i) => {
                if (i === 0 && updateIdx === 'shift' || i !== 0) { // typeof n === 'number'
                    cb.mod({ idx: i/* , old: arr[i] */, value: arr[i] });
                }
            });
        }
    }
    clear() {
        if (!this._cleared) {
            this._cleared = true;
            this.len = this.arr.length;
            this.queue.length = 0;
        }
    }
}

class ObjectDelegate {
    constructor(obj) {
        this.obj = obj;
        this.keys = Object.keys(obj);
        this.queue = []; // diff数据
        this._cleared = false;
    }
    add(v) {
        this._cleared = false;
        this.queue.push(v);
    }
    exec(cb) {
        this.queue.forEach(v => {
            const { act, k } = v;
            switch (act) {
                case 'add':
                    cb.add(k, v.v);
                    break;
                case 'mod':
                    cb.mod(k, v.v, v.old);
                    break;
                case 'del':
                    cb.del(k, v.idx, v.old);
                    break;
            }
        });
    }
    clear() {
        if (!this._cleared) {
            this._cleared = true;
            this.queue.length = 0;
        }
    }
}

const delegate_map = new WeakMap();
const delegate = {
    createArray(arr) {
        const d = new ArrayDelegate(arr);
        return new Proxy(arr, {
            get: (obj, key) => {
                if (key === '$delegate') {
                    return d;
                } else if (/^\d+$/.test(key)) {
                } else if (key in arrProps) {
                    if (arrProps[key] === 1) {
                        return function(...argv) {
                            d.add({ key, argv });
                            return obj[key].apply(obj, argv);
                        };
                    }
                } else {
                    console.log('get', key);
                }
                return obj[key];
            },
            set: (obj, key, value) => {
                if (/^\d+$/.test(key)) {
                    d.add({ key: parseInt(key, 10), old: obj[key], value });
                } else if (key === 'length') {
                } else {
                    console.log('set', key, value);
                }
                obj[key] = value;
                return true;
            }
        });
    },
    createObject(obj) {
        const d = new ObjectDelegate(obj);
        return new Proxy(obj, {
            get: (obj, key) => {
                if (key === '$delegate') {
                    return d;
                } else if (key === 'constructor') {
                }
                return obj[key];
            },
            set: (obj, key, value) => {
                if (key in obj) {
                    d.add({ act: 'mod', k: key, v: value, old: obj[key] });
                } else {
                    d.add({ act: 'add', k: key, v: value });
                    d.keys.push(key);
                }
                obj[key] = value;
                return true;
            },
            deleteProperty: (obj, key) => {
                if (key in obj) {
                    const { keys } = d;
                    const idx = keys.indexOf(key);
                    d.add({ act: 'del', k: key, idx, old: obj[key] });
                    if (idx === 0) {
                        keys.shift();
                    } else if (idx === keys.length - 1) {
                        keys.pop();
                    } else {
                        keys.splice(idx, 1);
                    }
                    delete obj[key];
                }
                return true;
            }
        });
    },
    create(v) {
        if (v.$delegate) {
            return v;
        } else if (delegate_map.has(v)) {
            return delegate_map.get(v);
        } else {
            let d = v instanceof Array ? this.createArray(v) : this.createObject(v);
            delegate_map.set(v, d);
            return d;
        }
    }
};

class Context {
    constructor(document, components = {}) {
        this.document = document;
        this.components = components;
        this.instances = []; // 所有组件proto实例
        this.tasks = new Map();
        this.rendering = false;
    }
    createComponentProto(C, props = {}) {
        const create = (C, props) => {
            const c = new C(props);
            const { state } = c;
            for (const k in state) {
                const v = state[k];
                if (v instanceof Array || v instanceof Object && v !== null) {
                    state[k] = delegate.create(v);
                }
            }
            c.setState = (state, cb) => {
                cp.updateDom({ ...c.state, ...state }, c.state, state, cb);
            };
            return c;
        };
        let c, tpl, t = typeof C;
        if (t === 'function') {
            c = create(C, props);
            tpl = c.render();
        } else if (t === 'string') {
            tpl = C;
            c = create(Component, {});
        } else {
            tpl = c.render();
        }
        const cp = new ComponentProto(this, c, tpl);
        this.instances.push(cp);
        return cp;
    }
    addTask(task) {
        const { tasks } = this;
        const { cp, cb } = task;
        if (this.rendering) {
            cp.render();
            cp.resetState(); // 数组diff数据清理
            if (cb) cb();
        } else {
            if (!tasks.has(cp)) {
                tasks.set(cp, task);
                nextTick(() => {
                    this.rendering = true;
                    cp.render();
                    this.rendering = false;
                    cp.resetState(); // 数组diff数据清理
                    tasks.delete(cp);
                    if (cb) cb();
                });
            }
        }
    }
}

const vueact = {
    version: '0.0.1',
    Component,
    nodeMap: {
        atom: AtomNode,
        var: VarNode,
        exp: ExpNode,
        expr: ExprNode,
        if: IfNode,
        dom: DomNode,
        for: ForNode,
        list: ListNode,
        foreach: ForEachNode,
        map: MapNode,
        component: ComponentNode,
        fragment: FragmentNode
    },
    modelMap: {
        atom: AtomModel,
        var: VarModel,
        exp: ExpModel,
        expr: ExprModel,
        if: IfModel, // node.tag === 'if'
        for: ForModel,
        list: ListModel,
        foreach: ForEachModel,
        map: MapModel,
        dom: DomModel,
        component: ComponentModel
    },
    contexts: [],
    render(...argv) {
        const renderImpl = (C, selector, components = {}, props = {}) => {
            const el = document.querySelector(selector);
            const ctx = new Context(document, components);
            this.contexts.push(ctx);
            const cp = ctx.createComponentProto(C, props);
            const root = el.appendChild(cp.render());
            return {
                ctx,
                container: el,
                cp,
                root,
                update(props) {
                    this.cp.update(props);
                }
            };
        };
        if (argv.length === 1 && typeof argv[0] === 'object') {
            const { C, root: selector, components = {}, props = {} } = argv[0];
            return renderImpl(C, selector, components, props);
        } else {
            const [C, selector, components] = argv;
            return renderImpl(C, selector, components);
        }
    },

    // 示例相关接口
    demos: {},
    _activeDemo: null,
    activeDemo(v) {
        if (this._activeDemo === v) return;
        if (this._activeDemo) {
            this._activeDemo.root.style.display = 'none';
        }
        if (v) {
            v.root.style.display = '';
        }
        this._activeDemo = v;
    },
    runDemo(id, demoImpl) {
        const { demos } = this;
        const demo = id in demos ? demos[id] : (demos[id] = demoImpl());
        this.activeDemo(demo);
    }
};

if (typeof exports !== 'undefined') {
    exports.vueact = vueact;
}

})(this);
