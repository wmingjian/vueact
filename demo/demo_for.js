(function() {

const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let uid = 3;

// 测试复杂数组更新
class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            arr: [
                { id: 0, name: 'a' },
                { id: 1, name: 'b' },
                { id: 2, name: 'c' }
            ]
        };
    }
    handleUnshift() {
        const { arr } = this.state;
        const n = uid++;
        arr.unshift({ id: n, name: str.charAt(n) });
        this.setState({ arr });
    }
    handlePush() {
        const { arr } = this.state;
        const n = uid++;
        arr.push({ id: n, name: str.charAt(n) });
        this.setState({ arr });
    }
    handleShift() {
        const { arr } = this.state;
        arr.shift();
        this.setState({ arr });
    }
    handlePop() {
        const { arr } = this.state;
        arr.pop();
        this.setState({ arr });
    }
    render() {
        return `
            <div id="demo_for">
                <div>
                    arr.length=
                    <input type="text" value="{arr.length}" readonly="{true}" style="width:40px;" />
                    <input type="button" value="unshift" _action="unshift" />
                    <input type="button" value="push" _action="push" />
                    <input type="button" value="shift" _action="shift" disabled="{arr.length === 0}" />
                    <input type="button" value="pop" _action="pop" disabled="{arr.length === 0}" />
                </div>
                <ol class="x-list">
                    <for list="$arr,v,i">
                        <li>[{i}]id={v.id},name={v.name}-a</li>
                        <!--<li>[{i}]id={v.id},name={v.name}-b</li>-->
                    </for>
                </ol>
            </div>
        `;
    }
}

vueact.runDemo('demo_for', () => {
    return vueact.render(Demo, '#root');
});

})();