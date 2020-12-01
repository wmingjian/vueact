class AttrNode { // TODO extends VNode
    constructor(model) {
        this.id = uid('attr');
        this.componentProto = model.proto; // {ComponentProto}
        this.model = model;
        this.attrType = '';
        this.attrName = '';
        this.node = null;
        this.attr = null; // Dom Attr
    }
    setNode(v) {
        this.node = v;
    }
    setAttr(v) {
        this.attr = v;
    }
    getValue() {
        return '';
    }
    renderAttr() {
    }
}

class StringAttr extends AttrNode {
    constructor(model, value) {
        super(model);
        this.attrType = 'string';
        this.value = value;
    }
    getValue() {
        return this.value;
    }
}

class ActionAttr extends AttrNode {
    constructor(model, action) {
        super(model);
        this.attrType = 'action';
        this.action = action;
    }
    getValue() {
        return this.action;
    }
}

class VarAttr extends AttrNode {
    constructor(model, value) {
        super(model);
        this.attrType = 'var';
        const name = value.name;
        this.name = name;
        this._value = value;
        const v = model.getVarObj(name);
        model.addDepAll(v.type, name); // TODO
        this.componentProto.addRef(v.type + '#' + name, this);
        this.varType = v.type; // props,state,local,unknown
    }
}

class ExprAttr extends AttrNode {
    constructor(model, value) {
        super(model, value);
        this.attrType = 'expr';
        this.expr = expr.parse(model, value.text); // {Expr}
        for (const k in this.expr.deps) {
            const v = model.getVarObj(k);
            model.addDepAll(v.type, k); // TODO
            this.componentProto.addRef(v.type + '#' + k, this);
        }
    }
    getValue(vnode) {
        return this.expr.evaluate(vnode);
    }
    renderAttr() {
        const v = this.getValue(this.node);
        this.node.el.setAttribute(this.attr.nodeName, v);
    }
}
