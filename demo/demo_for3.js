(function() {

const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let count = 0;

// 测试数组不变,state变化时列表更新逻辑
class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            a: 'a',
            arr: [0, 1, 2]
        };
    }
    handleChange() {
        count++;
        const a = str.charAt(count % str.length);
        this.setState({ a });
    }
    render() {
        return `
            <div id="demo_for">
                <input type="button" value="change" _action="change" />
                <ol class="x-list">
                    <for list="$arr,v,i">
                        <li>[{i}]{v},{a}</li>
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
