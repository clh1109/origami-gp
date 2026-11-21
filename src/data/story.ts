export interface ChapterStory {
  pageLabel: string;
  epigraph: string;
  stampTitle: string;
}

export const CHAPTER_STORIES: Record<string, ChapterStory> = {
  meadow: {
    pageLabel: '第 1 页 · 晨光序幕',
    epigraph: '趁主人去泡茶的十分钟，书页里的折纸小车手们悄悄发动了引擎……',
    stampTitle: '雏菊草甸·晨风印',
  },
  twilight: {
    pageLabel: '第 2 页 · 黄昏奇遇',
    epigraph: '台灯还没亮起，先借着纸灯笼的微光穿过晚霞笼罩的小巷！',
    stampTitle: '暮色纸镇·灯火印',
  },
  frost: {
    pageLabel: '第 3 页 · 冬日来信',
    epigraph: '一封寄往冬天的蓝色信封被微风吹开了口子，冰晶折纸在谷底闪闪发光。',
    stampTitle: '冰霜峡谷·邮戳印',
  },
  desk: {
    pageLabel: '第 4 页 · 终章狂飙',
    epigraph: '冲出书页的边缘！在铅笔、橡皮与便利贴之间决出真正的书桌之王！',
    stampTitle: '午后书桌·总冠军',
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
