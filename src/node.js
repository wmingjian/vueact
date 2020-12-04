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
        if (!(type === _t('if') && tag !== 'if')) {
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
