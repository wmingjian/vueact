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
            } catch (e) {
            }
        }
    } else if (window.DOMParser && document.implementation && document.implementation.createDocument) { // 支持Mozilla浏览器
        try {
            domParser = new DOMParser();
            xmlDoc = domParser.parseFromString(xmlString, 'text/xml');
        } catch (e) {
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

function trim(str) {
    return str.replace(/^[\s\n]+|[\s\n]+$/g, '');
}

function formatName(name) {
    return name.replace(/(^|_)([a-z])/g, (_, a, b) => b.toUpperCase());
}

function addChildren(children, c) {
    if (c) {
        if (c instanceof Array) {
            c.forEach(v => children.push(v));
        } else {
            children.push(c);
        }
    }
}

function addElements(parent, el) {
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

function t(type) {
    if (!(type in types)) {
        types[type] = typeUid++;
    }
    return type;
}

function ast2fun(ast, options) {
    function formatProp(prop) {
        const pt = typeof prop;
        if (pt === 'string' || pt === 'number' || pt === 'boolean') {
            if (options.diff) {
                return 0;
            }
            return JSON.stringify(prop);
        } else if (pt === 'object') {
            if (prop.type === t('expr')) {
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
            } else if (prop.type === t('var')) {
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
        sb.push(`,${list},(${v},${i})=>${formatNodes(children, level)}`);
        sb.push(')');
        return sb.join('');
    }
    function node2jsx(node, level = 0) {
        if (typeof node === 'string') {
            return JSON.stringify(node);
        }
        const { type } = node;
        if (type === t('dom') || type === t('component')) {
            return formatNode(node, level);
        } else if (type === t('if')) {
            const { id, tag, exp, props, children } = node;
            if (tag === 'if') {
                return `h(${id},${f(type)}${ft(tag)}{exp:${formatProp(exp)}},` // TODO exp会计算两次，可能有副作用
                    + `(e)=>e?${formatNodes(children, level)}:0`
                    + `)`;
            } else {
                return formatNode({ ...node, props: { 'v-if': exp, ...props } }, level);
            }
        } else if (type === t('for')) {
            const { id, tag, props, children, list, v, i } = node;
            if (tag === 'for') {
                return `h(${id},${f(type)}${ft(tag)}{},${list},(${v},${i})=>${formatNodes(children, level)})`;
            } else {
                return formatForNode(node, level);
            }
        } else if (type === t('expr')) {
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
        } else if (type === t('atom')) {
            if (options.diff) {
                return 0;
            }
            return 'h(' + node.id + ',' + f(node.type) + JSON.stringify(node.value) + ')';
        } else if (type === t('var')) {
            return 'h(' + node.id + ',' + f(node.type) + node.name + ')';
        } else if (type === t('exp')) {
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
                        nodes.push({ type: t('var'), name: v });
                    } else {
                        nodes.push({ type: t('exp'), value: v }); // TODO
                    }
                } else {
                    nodes.push({ type: t('atom'), t: 'string', value: trim(v) });
                }
            }
            expStart = !expStart;
        }
        return { id: -1, type: t('expr'), nodes, text: str };
    }
    function parseProp(value) {
        let v = value, a;
        if (value.charAt(0) === '$') {
            v = { type: t('var'), name: value.substr(1) };
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
            return t('dom');
        } else if (/^[A-Z]/.test(tag)) {
            return t('component');
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
                                type: t('if'),
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
                        addChildren(children, x);
                    }
                }
                if (ifNode) {
                } else if (tag === 'if') {
                    vn.type = t('if');
                    const { exp } = props;
                    delete props.exp;
                    vn.exp = parseProp(exp);
                } else if (tag === 'for') {
                    vn.type = t('for');
                    const { list } = props;
                    delete props.list;
                    const a = list.substr(1).split(',');
                    vn.list = a[0];
                    vn.v = a[1];
                    vn.i = a[2];
                } else if ('v-for' in props && (tag === 'ul' || tag === 'ol' || tag === 'dt' || tag === 'div')) {
                    vn.type = t('for');
                    const { 'v-for': list } = props;
                    delete props['v-for'];
                    const a = list.substr(1).split(',');
                    vn.list = a[0];
                    vn.v = a[1];
                    vn.i = a[2];
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
    const allNodes = [];
    const doc = this.doc = loadXMLString(xml);
    const ast = parseVNode(null, doc.documentElement);
    const ss = JSON.stringify(ast);
    const func = ast2fun(ast, { type: true, tag: true }); // 生成完整代码
    const func2 = ast2fun(ast, { type: false, tag: false, diff: true }); // 生成diff代码
    return {
        root: ast,
        nodes: allNodes,
        renderDom: new Function('h', '$', func),
        renderDiff: new Function('h', '$', func2)
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

class ListModel extends ForModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'list';
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
        this._el = null; // {Element}
        if (!(type === 'if' && tag !== 'if')) {
            for (const k in model.deps) { // 根据model的deps添加
                this.proto.addRef(k, this);
            }
        }
    }
    dispose() {
        this._el = null;
        this.model = null;
        this.proto = null;
    }
    get el() {
        return this._el;
    }
    set el(v) {
        if (v instanceof Array) {
            debugger;
        }
        this._el = v;
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
    }
    render() {
        return null;
    }
}

class IfNode extends VNode {
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
        this.holder = null; // 占位符
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
            : this.holder || (this.holder = doc.createComment('if ' + this.id));
        if (exp) {
            if (elements.length === 0) {
                for (let i = 0, len = children.length; i < len; i++) {
                    const child = children[i];
                    if (child) {
                        addChildren(elements, child.renderNode());
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
                const p = elements[0].parentNode;
                p.replaceChild(container, elements[0]);
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
        addChildren(this.children, c);
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
                            addChildren(elements, child.renderNode());
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
                const p = elements[0].parentNode;
                const ph = this.holder || (this.holder = this.doc.createComment('if ' + this.id));
                p.replaceChild(ph, elements[0]);
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
                if (t === 'string' || t === 'number' || t === 'boolean') {
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
                    addElements(el, child.renderNode());
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
        this.dataList = data.list.slice(0) || [];
        this.nodeList = [];
        this.holder = null; // 占位符
    }
    render() {
        const fragment = this.el || this.doc.createDocumentFragment();
        this.children.forEach(c => {
            const el = c.renderNode();
            addElements(fragment, el);
        });
        return fragment;
    }
    renderAll(renderer, list, func) {
        if (!this.fullFunc) {
            this.fullFunc = func;
        }
        list.forEach((v, i) => {
            renderer.openBlock();
            this.blocks.push(renderer.block);
            const c = func(v, i);
            renderer.closeBlock();
            this.nodeList.push(c);
            addChildren(this.children, c);
        });
    }
    compare(a, b, cb) {
        const al = a.length;
        const bl = b.length;
        const queue = [];
        for (let i = 0, len = Math.max(al, bl); i < len; i++) {
            if (i < al) {
                if (i < bl) {
                    if (typeof a[i] === typeof b[i] && a[i] === b[i]) {
                        queue.push({ act: 'mod', idx: i, old: a[i], value: b[i] }); // TODO 应该可以省略
                    } else {
                        queue.push({ act: 'mod', idx: i, old: a[i], value: b[i] });
                    }
                } else {
                    queue.push({ act: 'del', idx: i, old: a[i]});
                }
            } else {
                queue.push({ act: 'add', idx: i, value: b[i] });
            }
        }
        queue.forEach(v => cb[v.act](v));
    }
    renderDiff(renderer, list, func) {
        const { children, nodeList, dataList, blocks, holder } = this;
        let n0;
        const { parentNode } = nodeList.length === 0 // 如果删空了，会找不到parentNode
            ? holder
            : (
                n0 = nodeList[0],
                n0 instanceof Array ? n0[0].el : n0.el
            );
        this.compare(dataList, list, {
            add: ({ idx, value }) => { // v, i, act
                renderer.openBlock();
                blocks.push(renderer.block); // TODO
                const c = (this.fullFunc || func)(value, idx);
                renderer.closeBlock();
                nodeList.push(c);
                const len = dataList.length;
                if (len === 0) {
                    parentNode.removeChild(holder);
                }
                if (idx === 0) {
                    dataList.unshift(value);
                } else if (idx === len) {
                    dataList.push(value);
                } else {
                    dataList.splice(idx, 0, value);
                }
                addChildren(children, c);
                addElements(parentNode, c instanceof Array ? c.map(v => v.renderNode()) : c.renderNode());
            },
            mod: ({ idx, value }) => { // TODO
                renderer.openBlock(blocks[idx]);
                func(value, idx);
                renderer.closeBlock();
                dataList[idx] = value;
            },
            del: ({ idx }) => { // TODO
                const c = nodeList[idx];
                if (dataList.length === 1) {
                    const ph = holder || (this.holder = this.doc.createComment('for ' + this.id));
                    const ref = c instanceof Array ? c[0].el : c.el;
                    ref.parentNode.insertBefore(ph, ref);
                }
                if (c instanceof Array) {
                    c.forEach(v => {
                        v.remove();
                    });
                } else {
                    c.remove();
                }
                nodeList.splice(idx, 1);
                dataList.splice(idx, 1);
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
        this.children.forEach(c => {
            addElements(el, c.renderNode());
        });
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
        this.c.onPropsChange(props);
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
            if (type === 'var') {
                this.block.addRef(__node.name, vnode);
            } else if (type === 'exp') {
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
    render_for(model, id, type, tag, props, list, func) {
        const { all } = this.block;
        let vnode;
        if (id in all) {
            vnode = all[id];
            vnode.update(this, list, func);
        } else {
            vnode = model.createVNode({ props, list });
            vnode.renderAll(this, list, func);
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
                if (t === 'string' || t === 'number' || t === 'boolean') {
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
                addChildren(vnode.children, c);
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
                if (t === 'string' || t === 'number' || t === 'boolean') {
                } else if (value.type === 'var') { // /^\$\w+$/.test(value)
                    C = VarAttr;
                } else if (value.type === 'expr') { // indexOf('{') !== -1
                    C = ExprAttr;
                }
            }
            attrs[k] = C ? new C(model, value) : value;
        }
        return attrs;
    }
    parseVNode(parent, node) {
        let model = null;
        const nt = typeof node;
        if (nt === 'string' || nt === 'number' || nt === 'boolean') {
            model = new AtomModel(this, parent, node, nt);
        } else if (nt === 'object') {
            const type = node.type === 'for' && node.tag !== 'for' ? 'list' : node.type;
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
        for (const k in props) {
            this.c.props[k] = props[k];
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
}

const arrProps = {
    length: 1,
    push: 1,
    pop: 1,
    unshift: 1,
    shift: 1,
    constructor: 1,
    slice: 1,
    forEach: 1
};

const delegate = {
    createArray(arr) {
        return new Proxy(arr, {
            get: (obj, prop) => {
                if (/^\d+$/.test(prop) || prop in arrProps) {
                } else {
                    console.log('get', prop);
                }
                return obj[prop];
            },
            set: (obj, prop, value) => {
                if (/^\d+$/.test(prop) || prop === 'length') {
                } else {
                    console.log('set', prop, value);
                }
                obj[prop] = value;
                return true;
            }
        });
    },
    createObject(obj) {
        return new Proxy(obj, {
            // TODO
        });
    }
};

class Context {
    constructor(document, components = {}) {
        this.document = document;
        this.components = components;
        this.instances = []; // 所有组件proto实例
        this.tasks = new Map();
    }
    createComponentProto(C, props = {}) {
        const create = (C, props) => {
            const c = new C(props);
            for (const k in c.state) {
                const v = c.state[k];
                if (v instanceof Array) {
                    c.state[k] = delegate.createArray(v);
                }
            }
            c.setState = (state, cb) => {
                cp.updateDom({ ...c.state, ...state }, c.state, state, cb);
            };
            return c;
        };
        let c, tpl;
        if (typeof C === 'function') {
            c = create(C, props);
            tpl = c.render();
        } else if (typeof C === 'string') {
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
        const { cp, cb } = task;
        if (!this.tasks.has(cp)) {
            this.tasks.set(cp, task);
            nextTick(() => {
                cp.render();
                this.tasks.delete(cp);
                if (cb) cb();
            });
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
        if (argv.length === 1 && typeof argv[0] === "object") {
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
