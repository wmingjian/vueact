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
            this._addDep(k);
        }
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
        // TODO
    }
}

class IfModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'if';
        this.expr = expr.parse(this, node.exp.text); // {Expr}
        for (const k in this.expr.deps) {
            this._addDep(k);
        }
        this.attrs = this.proto.parseAttrs(this, node.props);
        this.nodes = this.buildChildren(this, node);
    }
}

class ForModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'for';
        this.name = this._addDep(node.name);
        this.nodes = this.buildChildren(this, node);
    }
}

class ForEachModel extends BlockModel {
    constructor(proto, parent, node) {
        super(proto, parent, node);
        this.type = 'foreach';
        this.name = this._addDep(node.name);
        this.nodes = this.buildChildren(this, node);
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
