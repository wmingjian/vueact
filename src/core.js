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
                cp.resetState(); // 数组diff数据清理
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
