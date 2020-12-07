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
            const vn = this.proto.parseVNode(parent, n);
            if (vn) {
                nodes.push(vn);
            }
        }
        return nodes;
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
        this.expr = expr.parse(this, node.text); // {Expr}
        for (const k in this.expr.deps) {
            const v = this.getVarObj(k);
            this.addDep(v.type, k);
        }
    }
}

class VarModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'var';
        const { name } = node;
        this.name = name;
        const v = this.getVarObj(name);
        this.addDep(v.type, name);
    }
}

class ExpModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'exp';
        this.value = node.value;
    }
}

class BlockModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        // TODO
    }
}

class IfModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'if';
        const { type, tag, props, exp } = node;
        this.tag = tag;
        this.expr = expr.parse(this, exp.text); // {Expr}
        for (const k in this.expr.deps) {
            const v = this.getVarObj(k);
            this.addDep(v.type, k);
        }
        this.attrs = this.proto.parseAttrs(this, props);
        this.nodes = this.buildChildren(this, node);
    }
}

class DomModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'dom';
        this.__node = node;
        const { tag, props } = node;
        this.tag = tag; // TODO 检查tag合法性
        this.attrs = this.proto.parseAttrs(this, props);
        this.nodes = this.buildChildren(this, node);
    }
}

class ForModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'for';
        const name = this.name = node.list;
        const v = this.getVarObj(name);
        this.addDep(v.type, name);
        const props = { ...node.props };
        this.attrs = props;
        this.nodes = this.buildChildren(this, node);
    }
}

class ForEachModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'foreach';
        const name = this.name = node.map;
        const v = this.getVarObj(name);
        this.addDep(v.type, name);
        const props = { ...node.props };
        this.attrs = props;
        this.nodes = this.buildChildren(this, node);
    }
}

class ListModel extends ForModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'list';
        this.tag = node.tag;
    }
}

class MapModel extends ForEachModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'map';
        this.tag = node.tag;
    }
}

class ComponentModel extends DomModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'component';
    }
}

class FragmentModel extends Model {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'fragment';
    }
}
