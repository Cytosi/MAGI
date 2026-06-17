const htmlEl = document.documentElement;
const isChrome = /Chrome/.test(navigator.userAgent);

htmlEl.setAttribute('data-is-chrome',isChrome);

const style = document.createElement('style');
document.head.appendChild(style);

// 设为空，彻底断开与在线字体切片接口的联系
let fontAPI = '';

const blockMojiRegex = /\s/g;


const checkFont = (fontName,weight=900)=>{
    const canvas = document.createElement('canvas');
    const w = 18;
    canvas.width = w;
    canvas.height = w;
    const ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);

    // 关键：这里必须用 900 weight 进行测试，否则测不准
    ctx.font = `${weight} ${w}px ${fontName},sans-serif`;
 
    ctx.fillStyle = '#000';
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.clearRect(0,0,w,w);
    ctx.fillText(
        '饑',
        0, w
    );
    const pixel = ctx.getImageData(0,0,w,w);
    const d = pixel.data;

    let aa =  0;
    for(let i=0;i<d.length;i+=4){
        aa += d[i+3];
    }

    const l = aa/w/w;
    document.body.removeChild(canvas);
    return l > 0;
};

// 检测核心字体是否已存在
let haveMatisse = checkFont('EVA_Matisse_Classic-EB,MatissePro-EB', 900);


let debug = /192\.168/.test(location.origin);

if(debug){
    haveMatisse = false;
}

// 核心函数：强制等待本地后备字体加载
const loadFallbackFonts = async () => {
    // Canvas 绘图前，必须确保字体文件已被浏览器解码
    // 这里明确请求 "900" 粗细，对应 CSS 中的 font-weight: 900
    try {
        await document.fonts.load('900 24px SourceHanSerifCN-Heavyall');
        // 如果你还有其他重要的后备字体，也可以加在这里
        // await document.fonts.load('900 24px NotoSerifSC-Black');
    } catch (e) {
        console.warn('Local fallback font loading skipped or failed', e);
    }
};


const getFontFromText = (name,text,onOver=_=>{})=>{
    // 不再进行 API 请求和子集化
    // 直接等待后备字体 Ready，然后立即开始绘制
    loadFallbackFonts().then(() => {
        requestAnimationFrame(onOver);
    });
}

// 此函数在纯本地模式下作用减弱，保留以兼容旧逻辑结构
const loadFont = async (fontName,fontURL,callback) => {
    if(haveMatisse) return requestAnimationFrame(callback);
    // 即使加载也强制指定 weight
	const fontFace = new FontFace(fontName, `url(${fontURL})`, { weight: '900' });
	fontFace.load().then(fontFace => {
		document.fonts.add(fontFace);
		callback(fontFace);
	}).catch(e=>{
        callback();
    })
};

function str2utf8(str) {
    return str.split('').map(s=>s.charCodeAt(0))
}
function utf82str(str) {
    return String.fromCharCode.apply(null,Array.from(str))
}


const deepCopy=o=>JSON.parse(JSON.stringify(o));

const inputEl = document.querySelector('textarea');
const checkboxEl = document.querySelector('input');
const outputEl = document.querySelector('#out');


const defaultMojiPlus = ' \n,-./01234567890:?ABCDEFGHILMNOPRSTUVabcdefghijklmnoprstuvwxyz“”、。「」いかくけげしせただちてでとなのはめもらるわをんアイカグシスゼダネバフマルレー一下不世中了京人今他伍作使來例価侵値僅先入八六其决况出到劳化匹博原参參叫可吃問喜嘗嘘器噪嚴四在型士壱太奇字存实室實市座庵弐当後徒微心情成我战戦戰拾持掃授排換支攷文新日明替最权来東案桌森標模樣歡求決沈浏海瀏版生用界發的監看督石神福秀章端第糊系終繁纪统网者臭螺襲覽览試話誕請议请跡輸轉逃选遇還郎配重野銳键間雨雷電面音頭題页项香驗验體魂鳴麦黙點🏼👩！，'.split('');

const getMoji = _=>{
    let v = defaultMojiPlus+layouts.map(a=>[a.inputs.map(t=>t.placeholder),a.exemples]).flat().join();
    return v;
};

let defaultMoji = Array.from(new Set(getMoji())).sort();


const diffDefaultMoji = text=>{
    return text.split('').filter(moji=>!defaultMoji.includes(moji)).join('').replace(/\s/g,'')
};


const texts = [
    '',
    '',
    '',
    '',
]
const defaultConfig = {
    blur:true,
    height:480,
    shadow:true,
    convolute: false,
    retina:true,
    plan:undefined,
    noise:true,
    outputRatio:1.334,
    // inverse:false,// Math.random()>0.9,
};
const outputRatios = [
    {
        value: 1.334,
        text: '4:3'
    },
    {
        value: 1.778,
        text: '16:9'
    },
    {
        value: 1,
        text: '3:3'
    },
    {
        value: 1.25,
        text: '5:4'
    },
    {
        value: 1.5,
        text: '3:2'
    },
]
const types = [
    {
        value: undefined,
        text:'DVD'
    },
    {
        value: 95,
        text: '95'
    }
]
const plans = [
    {
        value:undefined,
        text:'黑白'
    },
    {
        value:'wb',
        text:'白黑'
    },
    {
        value:'br',
        text:'黑红'
    },
    {
        value:'rw',
        text:'红白'
    },
    {
        value:'by',
        text:'黑黄'
    },
    // {
    //     value:'yb',
    //     text:'黄黑'
    // }
]
const data ={
    layout:null,
    layouts:[],
    config:deepCopy(defaultConfig),
    texts,
    loading:true,
    lastAllText:'',
    output: null,
    downloadFilename: null,
};
const Layouts = {}
layouts.forEach(layout=>{
    Layouts[layout.id] = layout;
});

const defaultTitle = document.title;


const textOrigin = '扫袭';
const textBefore = '掃襲';

const textFilter = text=>{
    return text;
};





const app = new Vue({
    el:'.app',
    data,
    methods:{
        make(){
            clearTimeout(make.timer);

            make.timer = setTimeout(_=>{
                const texts = this.layout.inputs.map((input,index)=>{
                    const {type} = input;
                    if(type==='tab'){
                        return this.texts[index];
                    }
                    return textFilter(this.texts[index] || input.placeholder)
                });

                this.loading = true;
                // 直接本地处理，不再 check API
                getFontFromText(fontFamilyName,texts.join(''), _=>{
                    make({
                        outputCanvas: this.$refs['canvas'],
                        texts,
                        config: this.config,
                        layout: this.layout
                    });
                    this.loading = false;
                    this.lastAllText = this.allText;
                });
            },200);
        },
        setLayout(_layout,noRoute){
            this.layout = _layout;
            const {inputs,config} = _layout;
            this.config = Object.assign({},defaultConfig,config);
            this.setDefaultTexts(_layout);

            const { id } = _layout;

            const title = `${_layout.title} - ${defaultTitle}`;

            document.title = title;

            if(!noRoute) history.replaceState({}, title, `./?layout=${encodeURIComponent(id)}`);
        },
        setExemple(exemple){
            exemple.forEach((t,i)=>{
                this.$set(this.texts,i,t);
            });
            this.make();
        },
        setDefaultTexts(layout){
            const {inputs} = layout;
            this.texts = inputs.map(input=>{
                const {type} = input;
                if(type === 'tab'){
                    return 0
                }
                return '';
            })
            this.make();
        },
        save(){
            const {canvas} = this.$refs;
            this.output = canvas.toDataURL('image/jpeg',.95);
            this.downloadFilename = `[lab.magiconch.com][福音戰士標題生成器]-${+Date.now()}.jpg`;
        },
        tc(){
            this.texts = this.texts.map(s=>{
                if(s.constructor === String) return transformFunc[2](s);

                return s
            });
            this.make();
        }
    },
    computed:{
        haveMatisse(){
            return haveMatisse
        },
        _text(){
            return this.layout.inputs.map((input,index)=>{
                const {type} = input;
                if(type==='tab'){
                    return this.texts[index];
                }
                return textFilter(this.texts[index] || input.placeholder)
            });
        },
        allText(){
            return this._text.join(',');
        },
        canTc(){
            return this.texts.join() !== transformFunc[2](this.texts.join())
        },
        noMatchMojis(){
            // 因为现在用全字库，这里其实可以放宽或者直接返回空
            // 暂时保留逻辑，仅检查 Matisse 字体是否支持
            return Array.from(new Set(this.allText)).sort().filter(m=>!EVAMatisseClassicMojis.includes(m))
        }
    },
    watch:{
        config:{
            deep:true,
            handler:'make'
        },
		output(v){
			document.documentElement.setAttribute('data-output',!!v);
		},
    }
})




const getQuerys = _=>{
	const GET = {};
	let queryString = location.search.slice(1);
	if(queryString){
		let gets = queryString.split(/&/g);
		gets.forEach(get=>{
			let [k,v] = get.split(/=/);
			GET[decodeURIComponent(k)] = decodeURIComponent(v);
		})
	};
	return GET
};

let outputCanvas = createCanvas();
let canvas = createCanvas();

const c = async callback=>{
    // 启动时优先加载后备字体
    await loadFallbackFonts();

    // 尝试加载其他辅助字体
    loadFont('notdef','NotDefault.woff2',async _=>{
        loadFont('baseSplit','base-split.woff?r=220716',async _=>{
             
             // 初始化生成布局预览
            layouts.slice().sort(_=>-1).forEach((layout,index)=>{
                let texts = [];
                texts = layout.inputs.map((input,index)=>{
                    return texts[index] || input.placeholder
                })
                const height = 240;
                const config = Object.assign({},defaultConfig,layout.config,{
                    height,
                    noise:false,
                    blur:1,
                });
                make({
                    outputCanvas,
                    canvas,
                    texts,
                    config,
                    layout
                })
                const src = makeBMPFormCanvas(outputCanvas)
                layout.src = src;
            })
            app.layouts = layouts;
            callback()
        })
    })
}

c(_=>{
    const GET = getQuerys();
    const layoutId = GET['layout'] || 'e1';
    if(Layouts[layoutId]){
        app.setLayout(Layouts[layoutId],1);
    }

    app.loading = false;
});