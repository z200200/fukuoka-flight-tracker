import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const LANG_KEY = 'fukuoka-tracker-lang';

export type Language = 'zh' | 'ja' | 'en';

// 所有翻译文本
const translations = {
  zh: {
    // Header & Status
    update: '更新',
    loading: '加载航班数据...',
    refreshing: '刷新中...',
    mapTab: '地图',
    flightsTab: '航班',
    refresh: '刷新',

    // Flight lists
    arrivals: '到达航班',
    departures: '出发航班',
    noArrivals: '暂无到达航班',
    noDepartures: '暂无出发航班',
    from: '从',
    to: '飞往',

    // Map status
    tracking: '追踪',
    aircraft: '架飞机',
    tracks: '轨迹',
    trackUpdate: '轨迹更新',
    rescan: '重新扫描',

    // Popup labels
    icao24: 'ICAO24',
    altitude: '高度',
    speed: '速度',
    heading: '航向',
    country: '国家',
    status: '状态',
    icaoCode: 'ICAO代码',
    iataCode: 'IATA代码',
    coordinates: '坐标',
    onGround: '地面',
    inAir: '空中',
    ground: '地面',
    noData: '无',
    meter: '米',
    meterPerSec: '米/秒',
    kmPerHour: 'km/h',
    degree: '°',

    // Airport names
    fukuoka: '福冈',
    tokyo: '东京',
    incheon: '首尔',

    // Welcome modal
    title: 'Flight Tracker',
    subtitle: '实时航班追踪系统',
    about: '// 关于',
    aboutText: '这是一个实时航班追踪应用，可以查看福冈、东京（成田+羽田）、首尔仁川三大机场周边的航班动态。',
    features: '// 功能',
    feature1: '实时追踪 - 每10秒自动刷新飞机位置',
    feature2: '航迹显示 - 渐变颜色显示飞行轨迹',
    feature3: '航班信息 - 查看航班号、航线、航空公司',
    howto: '// 操作',
    step1: '点击顶部按钮切换机场',
    step2: '点击右侧航班列表高亮对应飞机',
    step3: '点击地图上的飞机查看详情',
    start: '开始探索',
  },
  ja: {
    // Header & Status
    update: '更新',
    loading: 'フライトデータを読み込み中...',
    refreshing: '更新中...',
    mapTab: '地図',
    flightsTab: 'フライト',
    refresh: '更新',

    // Flight lists
    arrivals: '到着便',
    departures: '出発便',
    noArrivals: '到着便がありません',
    noDepartures: '出発便がありません',
    from: '',
    to: '行き',

    // Map status
    tracking: '追跡中',
    aircraft: '機',
    tracks: '軌跡',
    trackUpdate: '軌跡更新',
    rescan: '再スキャン',

    // Popup labels
    icao24: 'ICAO24',
    altitude: '高度',
    speed: '速度',
    heading: '方位',
    country: '国',
    status: '状態',
    icaoCode: 'ICAOコード',
    iataCode: 'IATAコード',
    coordinates: '座標',
    onGround: '地上',
    inAir: '飛行中',
    ground: '地上',
    noData: 'なし',
    meter: 'm',
    meterPerSec: 'm/s',
    kmPerHour: 'km/h',
    degree: '°',

    // Airport names
    fukuoka: '福岡',
    tokyo: '東京',
    incheon: 'ソウル',

    // Welcome modal
    title: 'Flight Tracker',
    subtitle: 'リアルタイム航空追跡システム',
    about: '// 概要',
    aboutText: 'このアプリは福岡、東京（成田+羽田）、ソウル仁川の空港周辺のフライト状況をリアルタイムで追跡できます。',
    features: '// 機能',
    feature1: 'リアルタイム追跡 - 10秒ごとに自動更新',
    feature2: '軌跡表示 - グラデーションで飛行経路を表示',
    feature3: 'フライト情報 - 便名、路線、航空会社を確認',
    howto: '// 操作方法',
    step1: '上部ボタンで空港を切り替え',
    step2: '右側のフライトリストをクリックで機体をハイライト',
    step3: '地図上の機体をクリックで詳細表示',
    start: '始める',
  },
  en: {
    // Header & Status
    update: 'Updated',
    loading: 'Loading flight data...',
    refreshing: 'Refreshing...',
    mapTab: 'Map',
    flightsTab: 'Flights',
    refresh: 'Refresh',

    // Flight lists
    arrivals: 'Arrivals',
    departures: 'Departures',
    noArrivals: 'No arrivals',
    noDepartures: 'No departures',
    from: 'from',
    to: 'to',

    // Map status
    tracking: 'Tracking',
    aircraft: 'aircraft',
    tracks: 'tracks',
    trackUpdate: 'Track Update',
    rescan: 'Rescan',

    // Popup labels
    icao24: 'ICAO24',
    altitude: 'Altitude',
    speed: 'Speed',
    heading: 'Heading',
    country: 'Country',
    status: 'Status',
    icaoCode: 'ICAO Code',
    iataCode: 'IATA Code',
    coordinates: 'Coordinates',
    onGround: 'On Ground',
    inAir: 'In Air',
    ground: 'Ground',
    noData: 'N/A',
    meter: 'm',
    meterPerSec: 'm/s',
    kmPerHour: 'km/h',
    degree: '°',

    // Airport names
    fukuoka: 'Fukuoka',
    tokyo: 'Tokyo',
    incheon: 'Seoul',

    // Welcome modal
    title: 'Flight Tracker',
    subtitle: 'Real-time Flight Tracking System',
    about: '// ABOUT',
    aboutText: 'A real-time flight tracking app for monitoring flights around Fukuoka, Tokyo (Narita+Haneda), and Seoul Incheon airports.',
    features: '// FEATURES',
    feature1: 'Live Tracking - Auto-refresh every 10 seconds',
    feature2: 'Flight Trails - Gradient colors show flight paths',
    feature3: 'Flight Info - View flight number, route, airline',
    howto: '// HOW TO USE',
    step1: 'Click top buttons to switch airports',
    step2: 'Click flight list to highlight aircraft',
    step3: 'Click aircraft on map for details',
    start: 'Get Started',
  },
};

export type Translations = typeof translations.zh;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('zh');

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) as Language;
    if (savedLang && ['zh', 'ja', 'en'].includes(savedLang)) {
      setLangState(savedLang);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  };

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
