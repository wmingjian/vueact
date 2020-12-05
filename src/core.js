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
            const { state } = c;
            for (const k in state) {
                const v = state[k];
                if (v instanceof Array) {
                    state[k] = delegate.createArray(v);
                } else if (v instanceof Object && v !== null) {
                    state[k] = delegate.createObject(v);
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
        if (!tasks.has(cp)) {
            tasks.set(cp, task);
            nextTick(() => {
                cp.render();
                cp.resetState(); // 数组diff数据清理
                tasks.delete(cp);
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
