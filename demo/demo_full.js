(function() {

// 复杂实例

const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

class List extends vueact.Component {
    constructor(props) {
        super(props);
        // console.error('props=', props);
        this.state = {
            list: props.list
        };
    }
    // componentWillReceiveProps
    onPropsChange(nextProps) {
        console.log('onPropsChange', nextProps);
        // const { list } = this.state;
        this.setState({ list: nextProps.list }); // TODO
    }
    render() {
        // console.log('List::render');
        return `
            <ul v-for="$list,v,i" class="x-list">
                <li>[{i}]{v}</li>
            </ul>
        `;
    }
}

class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        // console.log('Demo------');
        this.state = {
            a: 0,
            b: 1,
            act: 'test1',
            list: [
                'a',
                'b'
            ],
            arr: [0, 1, 2]
        };
    }
    handleAdd() {
        const { a } = this.state;
        this.setState({
            a: a + 1
        });
    }
    handleDec() {
        const { a } = this.state;
        this.setState({
            a: a - 1
        });
    }
    handleTest() {
        const { a, b, arr } = this.state;
        arr.push(arr.length);
        this.setState({ a: a + 1, b: b + 1, arr });
    }
    handleTest1() {
    }
    handlePushItem() {
        const { list, arr } = this.state;
        list.push(str.charAt(list.length));
        arr.push(arr.length);
        this.setState({ list, arr });
    }
    handlePopItem() {
        const { list, arr } = this.state;
        // list.pop();
        arr.pop();
        this.setState({ /* list,  */arr });
    }
    render() {
        return `
            <div id="demo_full" _action="$act">
                <div>
                    <input type="button" value="add_num{a}" _action="add" />
                    <input type="button" value="dec_num{a}" _action="dec" />
                    <input type="button" value="test" _action="test" />
                    <input type="button" value="arr_push" _action="push_item" />
                    <input type="button" value="arr_pop" _action="pop_item" disabled="{arr.length === 0}" />
                </div>
                {a}+{b}={a+b};
                <i class="$a">####</i>
                {a}/{b}={a/b};
                <ol v-if="{a}" class="x-list">
                    <for list="$list,v,i">
                        <li>[{i}]{v}+{x}</li>
                    </for>
                </ol>
                <if exp="{a+1}">
                    {a}
                    <div>xyz</div>
                </if>
                list=
                <List list="$list" />
                arr=
                <List v-if="{a}" list="$arr" />
            </div>
        `;
    }
}

vueact.runDemo('demo_full', () => {
    return vueact.render('<Demo x="abc" y="{123}" z="{true}" />'/*`
        <div id="demo0">
            <a href="https://www.baidu.com" target="_blank">baidu</a>
            <Demo x="abc" y="{123}" z="{true}" />
        </div>
    `*/, '#root', { Demo, List });
});

})();
