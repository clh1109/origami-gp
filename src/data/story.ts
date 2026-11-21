export interface ChapterStory {
  pageLabel: string;
  epigraph: string;
  rivalId: string;
  rivalName: string;
  rivalColor: string;
  preRaceLine: string;
  finalLapLine: string;
}

export const CHAPTER_STORIES: Record<string, ChapterStory> = {
  meadow: {
    pageLabel: '第 1 页 · 晨光序幕',
    epigraph: '趁主人去泡茶的十分钟，书页里的折纸小车手们悄悄发动了引擎……',
    rivalId: 'rabbit',
    rivalName: '纸兔·跃',
    rivalColor: '#f4a6b8',
    preRaceLine: '想翻到下一页？先赢过我的 120g 绘图纸再说！',
    finalLapLine: '最后一圈！隐约听见主人泡茶回来的脚步声了，全速冲刺！',
  },
  twilight: {
    pageLabel: '第 2 页 · 黄昏奇遇',
    epigraph: '台灯还没亮起，先借着纸灯笼的微光穿过晚霞笼罩的小巷！',
    rivalId: 'cat',
    rivalName: '玄猫·影',
    rivalColor: '#e07a5f',
    preRaceLine: '天快黑了，在折纸灯笼熄灭前你能追上我的影子吗？',
    finalLapLine: '最后一圈！整条纸镇的灯笼都在为你加油闪烁！',
  },
  frost: {
    pageLabel: '第 3 页 · 冬日来信',
    epigraph: '一封寄往冬天的蓝色信封被微风吹开了口子，冰晶折纸在谷底闪闪发光。',
    rivalId: 'owl',
    rivalName: '雪鸮·霜',
    rivalColor: '#4b8ab0',
    preRaceLine: '信封峡谷的弯道可不讲情面，别把车头折皱了哦。',
    finalLapLine: '最后一圈！穿过冰霜信封，下一站就是现实世界的书桌！',
  },
  desk: {
    pageLabel: '第 4 页 · 终章狂飙',
    epigraph: '冲出书页的边缘！在铅笔、橡皮与便利贴之间决出真正的书桌之王！',
    rivalId: 'box',
    rivalName: '方盒·灵',
    rivalColor: '#8eb87a',
    preRaceLine: '欢迎来到书桌终章，这片牛皮纸领地的冠军可不会轻易让给你！',
    finalLapLine: '最后一圈！冲过终点线，成为这本立体书里的传说车手！',
  },
};

export const RACER_QUOTES: Record<string, string[]> = {
  fox: [
    '听说第一个冲过折痕线，就能许一个永远不发皱的愿望！',
    '弯道越急，我的折纸尖耳破风越带劲！',
  ],
  rabbit: [
    '我可是用 120g 绘图纸折的，起步连风都追不上我！',
    '只要耳朵竖起来，就没有跳不过去的纸坡！',
  ],
  crane: [
    '别看我是千纸鹤，贴地滑翔一样能拿第一。',
    '风向正好，今天适合飞跃一整页草甸。',
  ],
  bear: [
    '300g 重磅牛皮卡纸，谁敢撞我就等着被弹飞吧！',
    '稳稳当当跑完三圈，再去吃块蜂蜜松饼。',
  ],
  boat: [
    '陆地也不过是干一点的大海嘛，扬帆起航！',
    '纸船不怕风浪，更不怕草地上的小土坡！',
  ],
  box: [
    '方方正正才最空气动力学——大概吧！',
    '我的秘密武器是藏在纸盒里的全能平衡术。',
  ],
  cat: [
    '嘘，趁大家还没反应过来，我已经滑进下一个弯道了。',
    '黑卡纸在夜巷里自带隐身光环，酷吧？',
  ],
  owl: [
    '每一道折痕的角度我都算好了，走线误差不超过一毫米。',
    '冷静、精准、优雅，这就是霜翼车手的信条。',
  ],
};

export const OVERTAKE_LINES = [
  '借过借过！折痕破风咯！',
  '漂亮超车！纸面都跟着震了一下！',
  '风向站在我这边，继续领跑！',
  '轻盈得像一阵穿过书页的风！',
];

export const OVERTAKEN_LINES = [
  '嘿嘿，我先去前面帮你探路啦！',
  '小心别被尾流吹皱了哦！',
  '刚才那一下漂移差点没稳住，追回来！',
  '别灰心，下一个弯道切回来！',
];
