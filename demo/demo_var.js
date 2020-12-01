(function() {

// 简单示例
class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            a: 1,
            b: 2,
            act: 'test'
        };
    }
    handleAdd() {
        const { a } = this.state;
        this.setState({
            a: a + 1
        });
    }
    render() {
        return `
            <div id="demo1" _action="$act">
                {a}+{b}={a+b};
                <input type="button" value="add_num{a}" _action="add" />
            </div>
        `;
    }
}

vueact.runDemo('demo1', () => {
    return vueact.render(`<Demo x="y" />`, '#root', { Demo });
});

})();
