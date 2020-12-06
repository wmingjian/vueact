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
        this.holder = null; // 占位符
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
            return this.holder || (this.holder = this.doc.createComment('for ' + this.id));
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
        const { blocks, holder } = this;
        if (blocks.length === 1) {
            const ph = holder || (this.holder = this.doc.createComment('for ' + this.id));
            const ref = c instanceof Array ? c[0].el : c.el;
            ref.parentNode.insertBefore(ph, ref);
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
        } else if (!this.holder) {
            this.holder = this.doc.createComment('for ' + this.id);
            pushElements(el, this.holder);
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
        this.holder = null; // 占位符
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
            return this.holder || (this.holder = this.doc.createComment('for ' + this.id));
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
        const { blocks, holder } = this;
        if (blocks.length === 1) {
            const ph = holder || (this.holder = this.doc.createComment('foreach ' + this.id));
            const ref = c instanceof Array ? c[0].el : c.el;
            ref.parentNode.insertBefore(ph, ref);
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
        } else if (!this.holder) {
            this.holder = this.doc.createComment('for ' + this.id);
            pushElements(el, this.holder);
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
