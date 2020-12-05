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
    }
    add(v) {
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
            const { prop } = v;
            if (typeof prop === 'number') {
                cb.mod({ idx: prop, old: v.old, value: v.value });
            } else {
                switch (prop) {
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
        this.len = this.arr.length;
        this.queue.length = 0;
    }
}

const delegate = {
    createArray(arr) {
        const d = new ArrayDelegate(arr);
        return new Proxy(arr, {
            get: (obj, prop) => {
                if (prop === '$diff') {
                    return d;
                } else if (/^\d+$/.test(prop)) {
                } else if (prop in arrProps) {
                    if (arrProps[prop] === 1) {
                        return function(...argv) {
                            // console.log(prop, argv);
                            d.add({ prop, argv });
                            return obj[prop].apply(obj, argv);
                        };
                    }
                } else {
                    console.log('get', prop);
                }
                return obj[prop];
            },
            set: (obj, prop, value) => {
                if (/^\d+$/.test(prop)) {
                    d.add({ prop: parseInt(prop, 10), old: obj[prop], value });
                } else if (prop === 'length') {
                } else {
                    console.log('set', prop, value);
                }
                obj[prop] = value;
                return true;
            }
        });
    },
    createObject(obj) {
        return new Proxy(obj, {
            // TODO
        });
    }
};
