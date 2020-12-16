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
                parseId(__node.value, (id) => {
                    this.block.addRef(id, vnode);
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
            vnode.initRef(this.block);
        }
        return vnode;
    }
}
