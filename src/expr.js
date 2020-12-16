class Expr {
    constructor(model, text) {
        this.model = model;
        this.text = text;
        this.deps = {};
        parseId(text, (id) => {
            this.addDep(id);
        });
    }
    addDep(name) {
        if (!(name in this.deps)) {
            this.deps[name] = 1;
        } else {
            this.deps[name]++;
        }
    }
    // TODO 改为真正的语法解析
    compile(code) {
        let s = code.replace(re_var, (_, name) => {
            if (/^\w+$/.test(name)) {
                this.addDep(name);
                return '" + ' + name + ' + "';
            } else { // name是一个表达式
                name.replace(/(\w+)/g, (_, n) => {
                    if (!/^\d+$/.test(n)) {
                        this.addDep(n);
                    }
                });
                return '" + (' + name + ') + "';
            }
        });
        if (code.charAt(0) === '{') {
            s = s.replace(/^\" \+ /, '');
        } else {
            s = '"' + s;
        }
        if (code.charAt(code.length - 1) === '}') {
            s = s.replace(/ \+ \"$/, '');
        } else {
            s = s + '"';
        }
        s = s.replace(/\n/g, '\\n');
        s = 'with(__scope){return ' + s + ';};'
        return new Function('__scope', s);
    }
    evaluate(vnode) {
        const scope = {};
        for (const k in vnode.model.depsAll) {
            const a = k.split('#');
            scope[a[1]] = vnode.getVar(a[1]);
        }
        return this.func(scope);
    }
}

const expr = {
    parse(model, text, cb) {
        const expr = new Expr(model, text);
        for (const k in expr.deps) {
            cb(k);
        }
        return expr;
    }
};
