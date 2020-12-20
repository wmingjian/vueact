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
        const t = typeof this.value;
        let parent;
        if (isAtom(t)) {
            parent = this.el;
            const v = this.value;
            if (parent) {
                parent.textContent = v;
                return parent;
            } else {
                return this.doc.createTextNode(v);
            }
        } else {
            return this.value[0].render();
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

class ElementNode extends VNode {
    constructor(model, data) {
        super(model, data);
        const { tag, attrs } = model;
        this.tag = tag; // TODO 检查tag合法性
        const children = data.children ? data.children.map(v => v) : [];
        this.props = { ...attrs, children };
        this.children = children;
    }
    initRef(block) {
        const { attrs } = this.model;
        for (const k in attrs) {
            const v = attrs[k];
            const t = typeof v;
            if (isAtom(t)) {
            } else if (v instanceof VarAttr) {
                block.addRef(v.name, v);
            } else if (v instanceof ExprAttr) {
                for (const key in v.expr.deps) {
                    block.addRef(key, v);
                }
            } else if (v instanceof ActionAttr) {
                if (typeof v.action === 'string') {
                } else if (v.action.type === 'var') {
                    block.addRef(v.action.name, v);
                } else if (v.action.type === 'expr') {
                    // console.error(v);
                }
            }
        }
    }
}

function renderAttrs(node, el) {
    const { proto, attrs } = node.model;
    if (attrs) { // TODO
        for (const k in attrs) {
            const attr = attrs[k];
            const t = typeof attr;
            if (isAtom(t)) {
                setAttr(el, k, attr);
            } else if (attr instanceof AttrNode) {
                let at = attr.attrType;
                if (at === 'action') {
                    proto.addAction(node.model, attr.action, el, node.data.props._action);
                } else {
                    setAttr(el, k, node.props[k]);
                    const domAttr = el.attributes[k];
                    attr.setAttr(domAttr);
                    if (at !== 'string') {
                        node.attributes[k] = domAttr;
                    }
                }
            }
        }
    }
}

class DomNode extends ElementNode {
    constructor(model, data) {
        super(model, data);
        const { attrs } = model;
        const props = this.props;
        for (const k in attrs) {
            const attr = attrs[k];
            if (typeof attr === 'string') {
            } else if (attr instanceof AttrNode) {
                attr.setNode(this);
                attr.attrName = k;
                props[k] = k in data.props ? data.props[k] : attr.getValue(this);
            }
        }
        this.attributes = {}; // 可变 attributes
    }
    render() {
        const { children } = this;
        const el = this.el || this.doc.createElement(this.tag);
        renderAttrs(this, el);
        if (children) {
            for (let i = 0, len = children.length; i < len; i++) {
                let child = children[i];
                if (child) {
                    pushElements(el, child.renderNode());
                    if (child instanceof Array) {
                        child.forEach(v => {
                            if (v.type === 'component') {
                                v.c.componentDidMount();
                            }
                        });
                    } else {
                        if (child.type === 'component') {
                            child.c.componentDidMount();
                        }
                    }
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

class BlockNode extends ElementNode {
    constructor(model, data) {
        super(model, data);
        this.name = model.__node.name;
        this.blocks = []; // [{Block}]
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
        this.blocks.push(null, null); // t, f
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
            ? this.blocks[0] || (f = this.fullFunc || (this.fullFunc = func), this.blocks[0] = new Block())
            : this.blocks[1] || (f = this.fullFunc || (this.fullFunc = func), this.blocks[1] = new Block())
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

class ForNode extends BlockNode {
    constructor(model, data) {
        super(model, data);
        this.nodeList = [];
    }
    createBlock(renderer, func, value, idx) {
        const block = renderer.openBlock();
        const c = (this.fullFunc || func)(value, idx);
        renderer.closeBlock();
        return { block, c };
    }
    render() {
        const { children } = this;
        if (children.length !== 0) {
            const fragment = this.el || this.doc.createDocumentFragment();
            children.forEach(c => {
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
        const { blocks, nodeList, children } = this;
        list.forEach((v, i) => {
            const { block, c } = this.createBlock(renderer, func, v, i);
            blocks.push(block);
            nodeList.push(c);
            pushChildren(children, c);
        });
    }
    compare0(a, b, cb) {
        const al = a.length;
        const bl = b.length;
        // b.forEach((v, i) => {});
        const queue = [];
        for (let i = 0, len = Math.max(al, bl); i < len; i++) {
            if (i < al) {
                if (i < bl) {
                    if (typeof a[i] === typeof b[i] && a[i] === b[i]) {
                        queue.push({ act: 'mod', idx: i, old: a[i], value: b[i] }); // TODO 应该可以省略
                    } else {
                        // console.log('mod', i);
                        queue.push({ act: 'mod', idx: i, old: a[i], value: b[i] });
                    }
                } else {
                    // console.log('del', i);
                    queue.push({ act: 'del', idx: i, old: a[i]});
                }
            } else {
                console.assert(i < bl, 'i error');
                // console.log('add', i);
                queue.push({ act: 'add', idx: i, value: b[i] });
            }
        }
        queue.forEach(v => cb[v.act](v));
    }
    compare(arr, cb) {
        if (arr.$delegate) {
            const refs = this.model.getRefs();
            // 使用proxy观察数组变化，省掉数组diff逻辑
            arr.$delegate.exec(cb, this.model.__node.i !== '', refs); // 数组变更的diff数据
        } else {
            this.compare0(this.dataList || [], arr, cb);
            this.dataList = arr.slice(0);
        }
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
        const { nodes } = this.model;
        let n0;
        const { parentNode } = nodeList.length === 0 // 如果删空了，会找不到parentNode
            ? holder
            : (
                n0 = nodeList[0],
                n0 instanceof Array ? n0[0].el : n0.el
            );
        const insert = (act, index, howmany, items) => {
            const n = nodes.length;
            const bs = [], cs = [], a = [], e = [];
            items.forEach((item, i) => {
                const { block, c } = this.createBlock(renderer, func, item, index + i);
                bs.push(block);
                cs.push(c);
            });
            cs.forEach(v => {
                if (v instanceof Array) {
                    v.forEach(vn => {
                        a.push(vn);
                        e.push(vn.renderNode());
                    })
                } else {
                    a.push(v);
                    e.push(v.renderNode());
                }
            });
            const len = nodeList.length;
            if (act === 'unshift') {
                const ref = len === 0 ? holder : children[index * n].el;
                blocks.unshift(...bs);
                nodeList.unshift(...cs);
                // dataList.unshift(...items);
                children.unshift(...a);
                insertElements(parentNode, e, ref);
            } else if (act === 'push') {
                blocks.push(...bs);
                nodeList.push(...cs);
                // dataList.push(...items);
                children.push(...a);
                pushElements(parentNode, e);
            } else if (act === 'splice') {
                const ref = index < len ? children[index * n].el : null;
                blocks.splice(index, howmany, ...bs);
                const c = nodeList.splice(index, howmany, ...cs);
                children.splice(index, howmany, ...a);
                insertElements(parentNode, e, ref);
                this.removeNode(c);
            }
            if (len === 0 && items.length > howmany) {
                parentNode.removeChild(holder);
            }
        };
        this.compare(/* dataList, */list, {
            unshift: (...items) => {
                insert('unshift', 0, 0, items);
            },
            push: (...items) => {
                insert('push', nodeList.length, 0, items);
            },
            splice: (index, howmany, ...items) => {
                insert('splice', index, howmany, items);
            },
            shift: () => {
                const c = nodeList.shift();
                this.removeNode(c);
                blocks.shift();
                nodes.forEach(v => children.shift()); // 更新children
            },
            pop: () => {
                const c = nodeList.pop();
                this.removeNode(c);
                blocks.pop();
                nodes.forEach(v => children.pop()); // 更新children
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

class ForEachNode extends BlockNode {
    constructor(model, data) {
        super(model, data);
        // override
        this.blocks = {}; // { k: {Block} }
        this.nodeList = [];
    }
    createBlock(renderer, func, value, key) {
        const block = renderer.openBlock();
        const c = (this.fullFunc || func)(value, key);
        renderer.closeBlock();
        return { block, c };
    }
    render() {
        const { children } = this;
        if (children.length !== 0) {
            const fragment = this.el || this.doc.createDocumentFragment();
            children.forEach((c, i) => {
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
        const { blocks, nodeList, children } = this;
        for (const k in map) {
            const { block, c } = this.createBlock(renderer, func, map[k], k);
            blocks[k] = block;
            nodeList.push(c);
            pushChildren(children, c);
        }
    }
    compare(obj, cb) {
        if (obj.$delegate) {
            const refs = this.model.getRefs();
            // 使用proxy观察对象变化，省掉对象diff逻辑
            obj.$delegate.exec(cb, this.model.__node.k !== '', refs); // 对象变更的diff数据
        }
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

// v-for
class ListNode extends ForNode {
    render() {
        const el = this.el || this.doc.createElement(this.tag);
        renderAttrs(this, el);
        const { children } = this;
        if (children.length !== 0) {
            children.forEach(c => {
                pushElements(el, c.renderNode());
            });
        } else {
            pushElements(el, this.getHolder());
        }
        return el;
    }
}

// v-foreach
class MapNode extends ForEachNode {
    render() {
        const el = this.el || this.doc.createElement(this.tag);
        const { children } = this;
        if (children.length !== 0) {
            children.forEach(c => {
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

class FragmentNode extends ElementNode {
    constructor(model) {
        super(model);
    }
    render() {
        return null;
    }
}
