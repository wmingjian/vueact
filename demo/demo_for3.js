(function() {

const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let count = 0;

// 测试数组不变,state变化时列表更新逻辑
class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            a: 'a',
            b: 'bb',
            c: 'ccc',
            d: true,
            arr: [0, 1, 2],
            list: ['x', 'y']
        };
    }
    handleChange(act, sender) {
        count++;
        const a = str.charAt(count % str.length);
        this.setState({ a });
    }
    handleBb(act, sender) {
        console.log(act, sender);
    }
    handleCcc1(act, sender) {
        console.log(act, sender);
    }
    render() {
        return `
            <div id="demo_for3">
                <input type="button" value="change" _action="change" />
                <ol class="x-list">
                    <for list="$arr,v,i">
                        <li id="{c+1}">
                            [{i}]{v},{a+1},
                            <b _action="$b">{1+a}</b>
                            <a href="#" _action="{c+1}">
                                <for list="$list,v2,i2">
                                    {v}|{v2}|{d}
                                </for>
                            </a>
                        </li>
                    </for>
                </ol>
                <ol class="x-list">
                    <for list="$arr,v,i">
                        <li>[{i}]{v}</li>
                    </for>
                </ol>
            </div>
        `;
    }
}

vueact.runDemo('demo_for3', () => {
    return vueact.render(Demo, '#root');
});

})();
