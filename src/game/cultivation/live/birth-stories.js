// These are memories from before the opening. They do not put a person, item,
// or unpaid debt into the current scene.
export const ORIGIN_BACKGROUNDS = Object.freeze({
  village: {
    'village-tracks': '带你进山的老猎户右脚有旧伤。他留下的脚印总是一深一浅。',
    'village-whistle': '守山人曾教你用三短一长的鸟哨报平安。外乡人很少知道这个暗号。',
    'village-cairn': '一次山洪中，采石人领你沿着石堆逃了出来。你记得哪块石头指向高处。',
  },
  artisan: {
    'artisan-mark': '师傅打制的器物，底部总多一道反刻的月牙。你曾替他磨过那把刻刀。',
    'artisan-ledger': '你替铺里的账房抄过一年账。他习惯把赊账人的姓藏在货名里。',
    'artisan-kiln': '窑工阿婆教过你看火色。你知道哪种裂纹是烧坏的，哪种是出窑后才敲出来的。',
  },
  ferry: {
    'ferry-knots': '老艄公教过你一种少见的双扣结。你认得他的手法。',
    'ferry-shoal': '小时候替摆渡人探过枯水期的暗滩。你记得哪条水线下藏着旧石阶。',
    'ferry-roll': '你曾替渡头掌柜抄船册。他给失踪船只销号时，总会留下最末一笔。',
  },
  exile: {
    'exile-chalk': '逃难时，同路的孩子用半扇门形的暗记标过安全的落脚处。你也画过。',
    'exile-bell': '旧驿站的守夜人曾放你进门避寒。你记得他换岗时总少敲一声铃。',
    'exile-song': '流散前，姐姐把故乡的路名编成了童谣。最后一句，只有你们两人会接。',
  },
});

export const TALENT_STORIES = Object.freeze({
  'keen-memory': {
    sense: '看过的文字记得牢，能从前后两份名册或口诀里找出改动。',
    effect: '查明功法缺处后，自己修补只需45天，通常要90天。',
  },
  'sensitive-breath': {
    sense: '擅长分辨细微的呼吸和脚步，有机会听出暗处还有谁。',
    effect: '谨慎寻物时，成功率最多提高8个百分点，例如从80%升到88%。',
  },
  'iron-bones': {
    sense: '筋骨扛得住力，遇到重物或险路，可以考虑亲自顶上。',
    effect: '防护加10点，交手、苦修和走险路时更容易撑过去。',
  },
  'sword-bone': {
    sense: '对剑路格外敏感，能从剑痕辨认出手的方向或留下的破绽。',
    effect: '主动强攻时，成功率最多提高8个百分点，例如从70%升到78%。',
  },
  'flash-wisdom': {
    sense: '容易把两条零散线索连起来，能想到一个值得验证的解释。',
    effect: '冲击下一境界时，成功率最多提高6个百分点，例如从60%升到66%。',
  },
  'fortune-debt': {
    sense: '险境里的意外也可能是机会；追上去，代价往往也更高。',
    effect: '冒险探寻物资，成功多得1份目标物资，失败多受1级伤。',
  },
});
