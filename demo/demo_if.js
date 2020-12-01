(function() {

// 测试if条件更新
class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            a: true
        };
    }
    handleToggle() {
        const { a } = this.state;
        this.setState({
            a: !a
        });
    }
    render() {
        return `
            <div id="demo_if">
                <if exp="{a}">
                    abc
                </if>
                <input type="button" value="toggle_{a}" _action="toggle" />
            </div>
        `;
    }
}

vueact.runDemo('demo_if', () => {
    return vueact.render(Demo, '#root');
});

})();
