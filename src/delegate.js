const arrProps = {
    length: 0,
    push: 1,
    pop: 1,
    unshift: 1,
    shift: 1,
    constructor: 0,
    slice: 0,
    forEach: 0
};

class ArrayDelegate {
    constructor(arr) {
        this.arr = arr;
        const len = arr.length;
        this.list = new Array(len); // emulate arr
        this.len = len; // 数组更新前的长度
        this.queue = []; // diff数据
        this._cleared = false;
    }
    add(v) {
        this._cleared = false;
        this.queue.push(v);
    }
    exec(cb, hasIdx) {
        let n = this.len;
        const { arr, list } = this;
        list.length = n;
        for (let i = 0; i < n; i++) {
            list[i] = i;
        }
        let updateIdx = '';
        this.queue.forEach(v => {
            const { key } = v;
            if (typeof key === 'number') {
                cb.mod({ idx: key, old: v.old, value: v.value });
            } else {
                switch (key) {
                    case 'unshift':
                        cb.unshift(v.argv[0]);
                        n++;
                        list.unshift('unshift');
                        updateIdx = 'unshift';
                        break;
                    case 'push':
                        cb.push(v.argv[0]);
                        n++;
                        list.push('push');
                        break;
                    case 'shift':
                        cb.shift();
                        n--;
                        list.shift();
                        updateIdx = 'shift';
                        break;
                    case 'pop':
                        cb.pop();
                        n--;
                        list.pop();
                        break;
                }
            }
        });
        if (hasIdx && updateIdx !== '') {
            list.forEach((n, i) => {
                if (i === 0 && updateIdx === 'shift' || i !== 0) { // typeof n === 'number'
                    cb.mod({ idx: i/* , old: arr[i] */, value: arr[i] });
                }
            });
        }
    }
    clear() {
        if (!this._cleared) {
            this._cleared = true;
            this.len = this.arr.length;
            this.queue.length = 0;
        }
    }
}

class ObjectDelegate {
    constructor(obj) {
        this.obj = obj;
        this.keys = Object.keys(obj);
        this.queue = []; // diff数据
        this._cleared = false;
    }
    add(v) {
        this._cleared = false;
        this.queue.push(v);
    }
    exec(cb) {
        this.queue.forEach(v => {
            const { act, k } = v;
            switch (act) {
                case 'add':
                    cb.add(k, v.v);
                    break;
                case 'mod':
                    cb.mod(k, v.v, v.old);
                    break;
                case 'del':
                    cb.del(k, v.idx, v.old);
                    break;
            }
        });
    }
    clear() {
        if (!this._cleared) {
            this._cleared = true;
            this.queue.length = 0;
        }
    }
}

const delegate_map = new WeakMap();
const delegate = {
    createArray(arr) {
        const d = new ArrayDelegate(arr);
        return new Proxy(arr, {
            get: (obj, key) => {
                if (key === '$delegate') {
                    return d;
                } else if (/^\d+$/.test(key)) {
                } else if (key in arrProps) {
                    if (arrProps[key] === 1) {
                        return function(...argv) {
                            d.add({ key, argv });
                            return obj[key].apply(obj, argv);
                        };
                    }
                } else {
                    console.log('get', key);
                }
                return obj[key];
            },
            set: (obj, key, value) => {
                if (/^\d+$/.test(key)) {
                    d.add({ key: parseInt(key, 10), old: obj[key], value });
                } else if (key === 'length') {
                } else {
                    console.log('set', key, value);
                }
                obj[key] = value;
                return true;
            }
        });
    },
    createObject(obj) {
        const d = new ObjectDelegate(obj);
        return new Proxy(obj, {
            get: (obj, key) => {
                if (key === '$delegate') {
                    return d;
                } else if (key === 'constructor') {
                }
                return obj[key];
            },
            set: (obj, key, value) => {
                if (key in obj) {
                    d.add({ act: 'mod', k: key, v: value, old: obj[key] });
                } else {
                    d.add({ act: 'add', k: key, v: value });
                    d.keys.push(key);
                }
                obj[key] = value;
                return true;
            },
            deleteProperty: (obj, key) => {
                if (key in obj) {
                    const { keys } = d;
                    const idx = keys.indexOf(key);
                    d.add({ act: 'del', k: key, idx, old: obj[key] });
                    if (idx === 0) {
                        keys.shift();
                    } else if (idx === keys.length - 1) {
                        keys.pop();
                    } else {
                        keys.splice(idx, 1);
                    }
                    delete obj[key];
                }
                return true;
            }
        });
    },
    create(v) {
        if (v.$delegate) {
            return v;
        } else if (delegate_map.has(v)) {
            return delegate_map.get(v);
        } else {
            let d = v instanceof Array ? this.createArray(v) : this.createObject(v);
            delegate_map.set(v, d);
            return d;
        }
    }
};
