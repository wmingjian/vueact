const arrProps = {
    length: 1,
    push: 1,
    pop: 1,
    unshift: 1,
    shift: 1,
    constructor: 1,
    slice: 1,
    forEach: 1
};

const delegate = {
    createArray(arr) {
        return new Proxy(arr, {
            get: (obj, prop) => {
                if (/^\d+$/.test(prop) || prop in arrProps) {
                } else {
                    console.log('get', prop);
                }
                return obj[prop];
            },
            set: (obj, prop, value) => {
                if (/^\d+$/.test(prop) || prop === 'length') {
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
