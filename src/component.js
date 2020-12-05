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
