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
