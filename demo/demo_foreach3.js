(function() {

// 测试对象更新

const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let count = 0;

class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            a: 'a',
            obj: {
                a: 'a',
                b: 'b',
                c: 'c'
            }
        };
    }
    handleChange() {
        count++;
        const a = str.charAt(count % str.length);
        this.setState({ a });
    }
    render() {
        return `
            <div id="demo_foreach3">
                <input type="button" value="change" _action="change" />
                <ol class="x-list">
                    <foreach map="$obj,v,k">
                        <li>[{k}]={v}-{a}</li>
                    </foreach>
                </ol>
            </div>
        `;
    }
}

vueact.runDemo('demo_foreach3', () => {
    return vueact.render(Demo, '#root');
});

})();
