(function() {

// 测试复杂数组更新
// 测试数组多个引用，diff更新问题
// 测试循环有无i参数

const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let uid = 3;

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
        let n = uid++;
        arr.unshift({ id: n, name: str.charAt(n) });
        n = uid++;
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
    handleSet() {
        const { arr } = this.state;
        // arr[0].name = 'abc'; // TODO 更新属性尚未监听
        arr[0] = { id: arr[0].id, name: 'abc' };
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
                    <input type="button" value="set" _action="set" disabled="{arr.length === 0}" />
                </div>
                <div style="overflow:hidden;">
                    <ol class="x-list" style="float:left;width:49%;box-sizing:border-box;">
                        <for list="$arr,v,i">
                            <li>[{i}]id={v.id},name={v.name}-a</li>
                            <!--<li>[{i}]id={v.id},name={v.name}-b</li>-->
                        </for>
                    </ol>
                    <ol class="x-list" style="float:left;width:49%;box-sizing:border-box;margin-left:2%;">
                        <for list="$arr,v">
                            <li>id={v.id},name={v.name}-a</li>
                        </for>
                    </ol>
                </div>
            </div>
        `;
    }
}

vueact.runDemo('demo_for', () => {
    return vueact.render(Demo, '#root');
});

})();
