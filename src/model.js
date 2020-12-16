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
        if (!parent) {
            this.all = [];
            this.allD = [];
            this.refs = {};
            this.allRefs = null;
        }
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
    _addDep(name) {
        const v = this.getVarObj(name);
        this.addDep(v.type, name);
        return name;
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
            const m = this.proto.createModel(parent, n);
            if (m) {
                nodes.push(m);
            }
            const bm = parent.getBlockModel();
            if (bm) {
                bm.add(m);
            }
        }
        return nodes;
    }
    getBlockModel() {
        if (!this.parent) {
            return this;
        }
        for (let p = this; p; p = p.parent) {
            if (p instanceof BlockModel || p.all) {
                return p;
            }
        }
        console.error('----');
        return null;
    }
    addRef(name) {
        if (!(name in this.refs)) {
            this.refs[name] = 1;
        } else {
            this.refs[name]++;
        }
    }
    add(m) {
        this.all.push(m);
        const { type } = m;
        if (type === 'atom') {
        } else if (type === 'var') {
            this.allD.push(m);
            this.addRef(m.name);
        } else if (type === 'exp') {
            this.allD.push(m);
            for (const k in m.expr.deps) {
                this.addRef(k);
            }
        } else if (type === 'dom' || type === 'component') {
            const { attrs } = m;
            let hasVar = false;
            for (const k in attrs) {
                const v = attrs[k];
                const t = typeof v;
                if (isAtom(t)) {
                } else if (t === 'object') {
                    if (v instanceof VarAttr) {
                        this.addRef(v.name);
                        hasVar = true;
                    } else if (v instanceof ExprAttr) {
                        for (const k in v.expr.deps) {
                            this.addRef(k);
                        }
                        hasVar = true;
                    } else if (v instanceof ActionAttr) {
                        if (typeof v.action === 'string') {
                        } else if (v.action.type === 'var') {
                            this.addRef(v.action.name);
                            hasVar = true;
                        } else if (v.action.type === 'expr') {
                            // console.error(v.action);
                            expr.parse(m, v.action.text, (name) => { // [TODO]解析时机太晚
                                this.addRef(name);
                            });
                            hasVar = true;
                        }
                    } else {
                        console.error('Model::add', v);
                    }
                }
            }
            if (hasVar) {
                this.allD.push(m);
            }
        } else if (type === 'for') {
            this.allD.push(m);
            this.addRef(m.name);
        } else if (type === 'expr' || type === 'if') {
            this.allD.push(m);
            // this.addRef(xxx); // TODO this.refs
        } else {
            console.log(m);
        }
    }
    getExclude() {
        return {};
    }
    getRefs() {
        if (this.allRefs) {
            return this.allRefs;
        }
        const refs = {};
        const map = {};
        const merge = (a, b, exclude) => {
            for (const k in exclude) {
                map[k] = exclude[k];
            }
            for (const k in b) {
                if (!(k in map)) {
                    a[k] = b[k];
                }
            }
        };
        merge(refs, this.refs, this.getExclude());
        for (let i = 0, len = this.allD.length; i < len; i++) {
            const m = this.allD[i];
            if (m.type === 'if' || m.type === 'for') {
                merge(refs, m.refs, m.getExclude());
            } else if (m.type === 'expr') {
                console.error('getRefs error');
            }
        }
        // console.log('getRefs', refs);
        this.allRefs = refs;
        return refs;
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
        this.expr = expr.parse(this, node.text, (name) => { // {Expr}
            this._addDep(name);
        });
    }
}

class VarModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'var';
        this.name = this._addDep(node.name);
    }
}

class ExpModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'exp';
        this.value = node.value;
        this.expr = expr.parse(this, node.value, (name) => {
            this._addDep(name);
        });
    }
}

class ElementModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.tag = node.tag; // TODO 检查tag合法性
        this.attrs = { ...node.props };
        this.nodes = [];
    }
}

class DomModel extends ElementModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'dom';
        this.attrs = this.proto.parseAttrs(this, node.props);
        this.nodes = this.buildChildren(this, node);
    }
}

class BlockModel extends ElementModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        // TODO 按照节点声明顺序保存
        this.all = []; // 全部子节点
        this.allD = []; // 全部动态节点
        this.refs = {};
    }
}

class IfModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'if';
        this.expr = expr.parse(this, node.exp.text, (name) => { // {Expr}
            this._addDep(name);
        });
        this.attrs = this.proto.parseAttrs(this, node.props);
        this.nodes = this.buildChildren(this, node);
    }
}

class ForModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'for';
        this.name = this._addDep(node.name);
        if (!parent) {
            this.addRef(this.name);
        }
        this.nodes = this.buildChildren(this, node);
    }
    getExclude() {
        const { __node } = this;
        const map = {};
        map[__node.v] = 1;
        if (__node.i) {
            map[__node.i] = 1;
        }
        return map;
    }
}

class ForEachModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'foreach';
        this.name = this._addDep(node.name);
        this.nodes = this.buildChildren(this, node);
    }
    getExclude() {
        const { __node } = this;
        const map = {};
        map[__node.v] = 1;
        if (__node.k) {
            map[__node.k] = 1;
        }
        return map;
    }
}

class ListModel extends ForModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'list';
    }
}

class MapModel extends ForEachModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'map';
    }
}

class ComponentModel extends DomModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'component';
    }
}

class FragmentModel extends ElementModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'fragment';
    }
}
