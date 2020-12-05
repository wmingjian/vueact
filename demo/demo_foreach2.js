(function() {

// 测试对象更新

const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let uid = 3;

class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            obj: {
                a: 'a',
                b: 'b',
                c: 'c'
            }
        };
    }
    handleAdd() {
        const { obj } = this.state;
        const n = uid++;
        const c = str.charAt(n);
        obj[c] = c;
        this.setState({ obj });
    }
    handleDelete() {
        const { obj } = this.state;
        delete obj.a;
        this.setState({ obj });
    }
    handleUpdate() {
        const { obj } = this.state;
        obj.a = 'abc';
        this.setState({ obj });
    }
    render() {
        return `
            <div id="demo_foreach2">
                <div>
                    <input type="button" value="add" _action="add" />
                    <input type="button" value="delete" _action="delete" />
                    <input type="button" value="update" _action="update" />
                </div>
                <div style="overflow:hidden;">
                    <ol class="x-list" style="float:left;width:49%;box-sizing:border-box;">
                        <foreach map="$obj,v,k">
                            <li>[{k}]={v}-a</li>
                        </foreach>
                    </ol>
                    <ol class="x-list" style="float:left;width:49%;box-sizing:border-box;margin-left:2%;" v-foreach="$obj,v">
                        <li>{v}-a</li>
                    </ol>
                </div>
            </div>
        `;
    }
}

vueact.runDemo('demo_foreach2', () => {
    return vueact.render(Demo, '#root');
});

})();
