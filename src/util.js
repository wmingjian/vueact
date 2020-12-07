function loadXMLString(xmlString) {
    let xmlDoc = null;
    if (!window.DOMParser && window.ActiveXObject) { // window.DOMParser 判断是否是非ie浏览器
        const xmlDomVersions = ['MSXML.2.DOMDocument.6.0', 'MSXML.2.DOMDocument.3.0', 'Microsoft.XMLDOM'];
        for (let i = 0, len = xmlDomVersions.length; i < len; i++) {
            try {
                xmlDoc = new ActiveXObject(xmlDomVersions[i]);
                xmlDoc.async = false;
                xmlDoc.loadXML(xmlString); // loadXML方法载入xml字符串
                break;
            } catch (ex) {
            }
        }
    } else if (window.DOMParser && document.implementation && document.implementation.createDocument) { // 支持Mozilla浏览器
        try {
            domParser = new DOMParser();
            xmlDoc = domParser.parseFromString(xmlString, 'text/xml');
        } catch (ex) {
        }
    } else {
        return null;
    }
    return xmlDoc;
}

const re_var = /\{([\w\.\+\-\*\/%\(\)\= ]+)\}/g;

const uids = {
    node: 0,
    model: 0,
    attr: 0,
    vnode: 0
};
function uid(type) {
    return uids[type]++;
}

function isAtom(t) { // primitive
    return t === 'string' || t === 'number' || t === 'boolean';
}

function trim(str) {
    return str.replace(/^[\s\n]+|[\s\n]+$/g, '');
}

function formatName(name) {
    return name.replace(/(^|_)([a-z])/g, (_, a, b) => b.toUpperCase());
}

function unshiftChildren(children, c) {
    if (c) {
        if (c instanceof Array) {
            for (let i = c.length - 1; i > 0; i--) {
                children.unshift(c[i]);
            }
        } else {
            children.unshift(c);
        }
    }
}

function pushChildren(children, c) {
    if (c) {
        if (c instanceof Array) {
            c.forEach(v => children.push(v));
        } else {
            children.push(c);
        }
    }
}

function unshiftElements(parent, el) {
    if (el) {
        const ref = parent.firstChild;
        if (el instanceof Array) {
            if (ref) {
                el.forEach(v => parent.insertBefore(v, ref));
            } else {
                el.forEach(v => parent.appendChild(v));
            }
        } else {
            if (ref) {
                parent.insertBefore(el, ref);
            } else {
                parent.appendChild(el);
            }
        }
    }
}

function pushElements(parent, el) {
    if (el) {
        if (el instanceof Array) {
            el.forEach(v => parent.appendChild(v));
        } else {
            parent.appendChild(el);
        }
    }
}

function setAttr(el, k, v) {
    if (k === '$class') {
        k = 'class';
    }
    if (k === 'style') {
        el.style.cssText = v;
    } else if (k === 'disabled' || k === 'readonly' || k === 'checked' || k === 'selected') {
        if (typeof v === 'boolean') {
            if (v) {
                el.setAttribute(k, k);
            } else {
                el.removeAttribute(k);
            }
        } else {
            console.error(v);
        }
    } else {
        if (v === null) {
            el.removeAttribute(k);
        } else {
            el.setAttribute(k, v);
        }
    }
}

// 以下代码参考 vue 2.x
const inBrowser = typeof window !== 'undefined';
const inWeex = typeof WXEnvironment !== 'undefined' && !!WXEnvironment.platform;
const weexPlatform = inWeex && WXEnvironment.platform.toLowerCase();
const UA = inBrowser && window.navigator.userAgent.toLowerCase();
const isIE = UA && /msie|trident/.test(UA);
const isIOS = (UA && /iphone|ipad|ipod|ios/.test(UA)) || (weexPlatform === 'ios');

function isNative(C) {
    return typeof C === 'function' && /native code/.test(C.toString());
}

let isUsingMicroTask = false;

const callbacks = [];
let pending = false;

function flushCallbacks() {
    pending = false;
    const copies = callbacks.slice(0);
    callbacks.length = 0;
    for (let i = 0, len = copies.length; i < len; i++) {
        copies[i]();
    }
}

let timerFunc;

if (typeof Promise !== 'undefined' && isNative(Promise)) {
    const p = Promise.resolve();
    timerFunc = () => {
        p.then(flushCallbacks);
        if (isIOS) {
            setTimeout(noop);
        }
    };
    isUsingMicroTask = true;
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
    isNative(MutationObserver) ||
    MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
    let counter = 1;
    const observer = new MutationObserver(flushCallbacks);
    const textNode = document.createTextNode(String(counter));
    observer.observe(textNode, {
        characterData: true
    });
    timerFunc = () => {
        counter = (counter + 1) % 2;
        textNode.data = String(counter);
    };
    isUsingMicroTask = true;
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
    timerFunc = () => {
        setImmediate(flushCallbacks);
    };
} else {
    timerFunc = () => {
        setTimeout(flushCallbacks, 0);
    };
}

function nextTick(cb, ctx) {
    let _resolve;
    callbacks.push(() => {
        if (cb) {
            try {
                cb.call(ctx);
            } catch (ex) {
                console.log(ex, ctx, 'nextTick');
            }
        } else if (_resolve) {
            _resolve(ctx);
        }
    });
    if (!pending) {
        pending = true;
        timerFunc();
    }
    if (!cb && typeof Promise !== 'undefined') {
        return new Promise((resolve) => {
            _resolve = resolve;
        });
    }
}
