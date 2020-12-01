(function() {

class Demo extends vueact.Component {
    constructor(props) {
        super(props);
        this.state = {
            a: 'a',
            n: 0
        };
    }
    handleStart() {
        const str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const len = str.length;
        let i = 0;
        const s0 = Date.now();
        // let timer = 0;
        const x = () => {
            /*
            if (timer !== 0) {
                clearTimeout(timer);
                timer = 0;
            }
            */
            i++;
            if (i < 100000) {
                this.setState({
                    a: str.charAt(i % len),
                    n: i % 16
                }/* , () => {} */);
                if (i % 200 === 0) {
                    /* timer =  */
                    setTimeout(x, 0);
                } else {
                    x();
                }
                // x();
            } else {
                const s1 = Date.now();
                console.log(s1 - s0);
            }
        };
        x();
    }
    render() {
        /*
        return `
            <div id="test_perf">
                <input type="button" value="start" _action="start" />
                <div v-if="{(n+0)%10}" id="{n+0}">0{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+1)%10}" id="{n+1}">1{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+2)%10}" id="{n+2}">2{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+3)%10}" id="{n+3}">3{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+4)%10}" id="{n+4}">4{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+5)%10}" id="{n+5}">5{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+6)%10}" id="{n+6}">6{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+7)%10}" id="{n+7}">7{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+8)%10}" id="{n+8}">8{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
                <div v-if="{(n+9)%10}" id="{n+9}">9{a+0}{a+1}{a+2}{a+3}{a+4}{a+5}{a+6}{a+7}{a+8}{a+9}</div>
            </div>
        `;
        */
        var tpls = [
            '<div id="test_perf">',
            '<input type="button" value="start" _action="start" />'
        ];
        for (var i = 0, len = 10; i < len; i++) {
            var sb = [];
            var a = [];
            for (var j = 0, len2 = 10; j < len2; j++) {
                sb.push(' a'+ j + '="{n+' + (i + j) + '}"');
                a.push('<i a="{' + j + '}">{a+' + j + '}</i>');
            }
            tpls.push('<div v-if="{(n+' + i + ')%10}"'
                + ' id="{n+' + (i + 1) + '}"' + sb.join('') + '>'
                + i + a.join('')
                + '</div>');
        }
        tpls.push('</div>');
        return tpls.join('');
    }
}

vueact.runDemo('test_perf', () => {
    return vueact.render(Demo, '#root');
});

})();
