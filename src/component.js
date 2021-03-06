class Component {
    constructor(props = {}) {
        this.props = props;
        this.state = {};
    }
    get children() {
        return [];
    }
    setState(state, cb) {
        // empty
    }
    shouldComponentUpdate() {}
    componentWillReceiveProps() {}
    componentDidUpdate() {}
    componentWillMount() {}
    componentDidMount() {}
    componentWillUnmount() {}
    componentDidUnmount() {}
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
        this.createRender = this.ast.render_create.func;
        this.updateRender = this.ast.render_update.func;
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
        return this.createModel(null, root);
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
    createModel(parent, node) { // parseVNode
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
    addAction(model, act, el, actionValue) {
        const action = typeof act === 'string'
            ? act
            : act.type === 'var' || act.type === 'expr'
                ? '' + actionValue // act.name
                : '';
        const findAction = (engine, action) => {
            let name = 'handle' + formatName(action); // act.charAt(0).toUpperCase() + act.substr(1)
            if (name in engine) {
                return name;
            } else {
                name = 'do_' + action;
                if (name in engine) {
                    return name;
                }
            }
            throw new Error('action not found: ' + action);
        };
        const name = findAction(this.c, action);
        el.onclick = () => {
            const ret = this.c[name](action, el);
            return typeof ret === 'boolean' ? ret : false;
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
        const data = { proto: this, component: this.c, props, state };
        if (!this.vnode) {
            this.vnode = this.renderer.run_render(this.createRender, data);
            return this.vnode.renderNode();
        } else {
            this.renderer.run_update(this.updateRender, data);
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
        const { c } = this;
        const s = c.state;
        for (const k in newState) {
            const v = s[k];
            const V = newState[k];
            const t = typeof v;
            if (isAtom(t) || v === V) {
                s[k] = V;
            } else if (v instanceof Array) {
                const hash = {};
                v.forEach(item => {
                    hash[item.path] = item;
                });
                V.forEach(item => {
                    hash[item.path] = item;
                });
            } else if (v instanceof Object && v !== null) {
                for (const key in V) {
                    v[key] = V[key];
                }
            }
        }
        this.ctx.addTask({
            cp: this,
            c,
            state: newState,
            cb
        });
    }
    resetState() {
        const { state } = this.c;
        for (const k in state) {
            const v = state[k];
            if (v instanceof Array || v instanceof Object && v !== null) {
                if (v.$delegate) {
                    v.$delegate.clear();
                }
            }
        }
    }
}
