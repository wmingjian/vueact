(function() {

// 测试简单数组更新
class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            arr: [0, 1, 2]
        };
    }
    handleUnshift() {
        const { arr } = this.state;
        arr.unshift(arr.length);
        this.setState({ arr });
    }
    handlePush() {
        const { arr } = this.state;
        arr.push(arr.length);
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
                        <li>[{i}]{v}-a</li>
                        <li>[{i}]{v}-b</li>
                    </for>
                </ol>
            </div>
        `;
    }
}

vueact.runDemo('demo_for2', () => {
    return vueact.render(Demo, '#root');
});

})();
