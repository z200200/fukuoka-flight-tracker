import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import styled from 'styled-components';
import type { FlightInfo, Flight } from '../types/flight';
import type { RouteInfo } from '../context/FlightContext';
import { useLanguage } from '../context/LanguageContext';

// 缩放范围配置
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;

// 航空公司代码多语言映射
type Language = 'zh' | 'ja' | 'en';
const AIRLINES: Record<Language, Record<string, string>> = {
  zh: {
    // 日本
    'JAL': '日本航空', 'ANA': '全日空', 'JJP': '捷星日本', 'APJ': '乐桃航空',
    'SFJ': '星悦航空', 'SKY': '天马航空', 'ADO': '北海道航空', 'SNA': '索拉西德航空',
    'IBX': 'IBEX航空', 'ORC': '东方空桥', 'NCA': '日本货航', 'FDA': '富士梦幻航空',
    // 韩国
    'KAL': '大韩航空', 'AAR': '韩亚航空', 'JNA': '真航空', 'TWB': '德威航空',
    'ABL': '釜山航空', 'JJA': '济州航空', 'ESR': '易斯达航空',
    // 中国
    'CCA': '中国国航', 'CES': '东方航空', 'CSN': '南方航空', 'CHH': '海南航空',
    'CSC': '四川航空', 'CXA': '厦门航空', 'CSZ': '深圳航空', 'CQH': '春秋航空',
    'DKH': '吉祥航空', 'CDG': '山东航空', 'GCR': '天津航空',
    // 港澳台
    'EVA': '长荣航空', 'CAL': '中华航空', 'TGW': '台湾虎航', 'CPA': '国泰航空',
    'HKE': '香港快运', 'NMG': '澳门航空', 'HXA': '香港航空',
    // 东南亚
    'SIA': '新加坡航空', 'VJC': '越捷航空', 'HVN': '越南航空', 'THA': '泰国航空',
    'MAS': '马来西亚航空', 'AXM': '亚洲航空', 'GIA': '印尼鹰航', 'CEB': '宿务太平洋',
    'PAL': '菲律宾航空', 'BKP': '曼谷航空', 'SJY': '酷航',
    // 中东
    'UAE': '阿联酋航空', 'ETD': '阿提哈德航空', 'QTR': '卡塔尔航空', 'THY': '土耳其航空',
    // 欧美
    'DLH': '汉莎航空', 'BAW': '英国航空', 'AFR': '法国航空', 'KLM': '荷兰皇家航空',
    'AAL': '美国航空', 'UAL': '美联航', 'DAL': '达美航空', 'SWA': '西南航空',
    'ACA': '加拿大航空', 'QFA': '澳洲航空', 'ANZ': '新西兰航空',
    // 货运
    'FDX': '联邦快递', 'UPS': 'UPS航空', 'GTI': '极地航空',
    // 其他
    'AFL': '俄罗斯航空', 'ETH': '埃塞俄比亚航空',
  },
  ja: {
    // 日本
    'JAL': '日本航空', 'ANA': '全日空', 'JJP': 'ジェットスター', 'APJ': 'ピーチ',
    'SFJ': 'スターフライヤー', 'SKY': 'スカイマーク', 'ADO': 'エア・ドゥ', 'SNA': 'ソラシドエア',
    'IBX': 'IBEX', 'ORC': 'オリエンタルエア', 'NCA': '日本貨物航空', 'FDA': 'フジドリーム',
    // 韓国
    'KAL': '大韓航空', 'AAR': 'アシアナ航空', 'JNA': 'ジンエアー', 'TWB': 'ティーウェイ航空',
    'ABL': 'エアプサン', 'JJA': 'チェジュ航空', 'ESR': 'イースター航空',
    // 中国
    'CCA': '中国国際航空', 'CES': '中国東方航空', 'CSN': '中国南方航空', 'CHH': '海南航空',
    'CSC': '四川航空', 'CXA': '厦門航空', 'CSZ': '深セン航空', 'CQH': '春秋航空',
    'DKH': '吉祥航空', 'CDG': '山東航空', 'GCR': '天津航空',
    // 港澳台
    'EVA': 'エバー航空', 'CAL': 'チャイナエア', 'TGW': 'タイガーエア台湾', 'CPA': 'キャセイパシフィック',
    'HKE': '香港エクスプレス', 'NMG': 'マカオ航空', 'HXA': '香港航空',
    // 東南アジア
    'SIA': 'シンガポール航空', 'VJC': 'ベトジェット', 'HVN': 'ベトナム航空', 'THA': 'タイ国際航空',
    'MAS': 'マレーシア航空', 'AXM': 'エアアジア', 'GIA': 'ガルーダ', 'CEB': 'セブパシフィック',
    'PAL': 'フィリピン航空', 'BKP': 'バンコクエアウェイズ', 'SJY': 'スクート',
    // 中東
    'UAE': 'エミレーツ', 'ETD': 'エティハド', 'QTR': 'カタール航空', 'THY': 'ターキッシュ',
    // 欧米
    'DLH': 'ルフトハンザ', 'BAW': 'ブリティッシュ', 'AFR': 'エールフランス', 'KLM': 'KLM',
    'AAL': 'アメリカン', 'UAL': 'ユナイテッド', 'DAL': 'デルタ', 'SWA': 'サウスウエスト',
    'ACA': 'エアカナダ', 'QFA': 'カンタス', 'ANZ': 'ニュージーランド航空',
    // 貨物
    'FDX': 'フェデックス', 'UPS': 'UPS', 'GTI': 'ポーラーエア',
    // その他
    'AFL': 'アエロフロート', 'ETH': 'エチオピア航空',
  },
  en: {
    // Japan
    'JAL': 'Japan Airlines', 'ANA': 'All Nippon Airways', 'JJP': 'Jetstar Japan', 'APJ': 'Peach Aviation',
    'SFJ': 'Star Flyer', 'SKY': 'Skymark', 'ADO': 'Air Do', 'SNA': 'Solaseed Air',
    'IBX': 'IBEX Airlines', 'ORC': 'Oriental Air Bridge', 'NCA': 'Nippon Cargo', 'FDA': 'Fuji Dream',
    // Korea
    'KAL': 'Korean Air', 'AAR': 'Asiana Airlines', 'JNA': 'Jin Air', 'TWB': 'T\'way Air',
    'ABL': 'Air Busan', 'JJA': 'Jeju Air', 'ESR': 'Eastar Jet',
    // China
    'CCA': 'Air China', 'CES': 'China Eastern', 'CSN': 'China Southern', 'CHH': 'Hainan Airlines',
    'CSC': 'Sichuan Airlines', 'CXA': 'Xiamen Air', 'CSZ': 'Shenzhen Airlines', 'CQH': 'Spring Airlines',
    'DKH': 'Juneyao Airlines', 'CDG': 'Shandong Airlines', 'GCR': 'Tianjin Airlines',
    // Taiwan/HK/Macau
    'EVA': 'EVA Air', 'CAL': 'China Airlines', 'TGW': 'Tigerair Taiwan', 'CPA': 'Cathay Pacific',
    'HKE': 'HK Express', 'NMG': 'Air Macau', 'HXA': 'Hong Kong Airlines',
    // Southeast Asia
    'SIA': 'Singapore Airlines', 'VJC': 'VietJet Air', 'HVN': 'Vietnam Airlines', 'THA': 'Thai Airways',
    'MAS': 'Malaysia Airlines', 'AXM': 'AirAsia', 'GIA': 'Garuda Indonesia', 'CEB': 'Cebu Pacific',
    'PAL': 'Philippine Airlines', 'BKP': 'Bangkok Airways', 'SJY': 'Scoot',
    // Middle East
    'UAE': 'Emirates', 'ETD': 'Etihad Airways', 'QTR': 'Qatar Airways', 'THY': 'Turkish Airlines',
    // Europe/Americas
    'DLH': 'Lufthansa', 'BAW': 'British Airways', 'AFR': 'Air France', 'KLM': 'KLM',
    'AAL': 'American Airlines', 'UAL': 'United Airlines', 'DAL': 'Delta Air Lines', 'SWA': 'Southwest',
    'ACA': 'Air Canada', 'QFA': 'Qantas', 'ANZ': 'Air New Zealand',
    // Cargo
    'FDX': 'FedEx Express', 'UPS': 'UPS Airlines', 'GTI': 'Polar Air Cargo',
    // Other
    'AFL': 'Aeroflot', 'ETH': 'Ethiopian Airlines',
  },
};

// 验证callsign是否有效（只包含字母数字）
function isValidCallsign(callsign: string | null): boolean {
  if (!callsign) return false;
  // 只允许字母、数字、空格
  return /^[A-Za-z0-9\s]+$/.test(callsign);
}

// 从callsign提取航空公司（多语言）
function getAirline(callsign: string | null, lang: Language): string {
  if (!callsign || !isValidCallsign(callsign)) return '';
  const code = callsign.replace(/[0-9]/g, '').trim();
  return AIRLINES[lang][code] || AIRLINES.en[code] || code;
}

// 机场ICAO代码到中文名称映射（福冈/成田/仁川三机场完整航线）
const AIRPORTS_NAME: Record<string, string> = {
  // 日本主要机场
  'RJFF': '福冈', 'RJAA': '成田', 'RJTT': '羽田', 'RJBB': '关西', 'RJCC': '新千岁',
  'RJGG': '中部', 'RJOO': '伊丹', 'RJNN': '名古屋', 'RJNA': '名古屋飞行场',
  // 日本九州
  'RJFK': '鹿儿岛', 'RJFU': '长崎', 'RJFT': '熊本', 'RJFE': '大分', 'RJFM': '宫崎',
  'RJFS': '佐贺', 'RJFN': '新北九州', 'RJFO': '大分', 'RJDM': '大村',
  // 日本冲绳/南西诸岛
  'ROAH': '那霸', 'ROIG': '石垣', 'RORS': '下地岛', 'ROYN': '与那国', 'ROMY': '宫古',
  // 日本中国/四国
  'RJOH': '米子', 'RJOB': '冈山', 'RJOC': '出云', 'RJOI': '岩国', 'RJOM': '松山',
  'RJOT': '高松', 'RJOS': '德岛', 'RJOK': '高知',
  // 日本近畿/中部
  'RJBE': '神户', 'RJNK': '小松', 'RJNT': '富山', 'RJNY': '松本',
  // 日本关东/东北
  'RJAH': '茨城', 'RJSN': '新潟', 'RJSS': '仙台', 'RJSK': '秋田', 'RJSF': '福岛',
  'RJSH': '三�的', 'RJSR': '大馆能代', 'RJSY': '山形',
  // 日本北海道
  'RJCH': '函馆', 'RJCB': '带广', 'RJCK': '�的路', 'RJCM': '女满别', 'RJCN': '中标津',
  'RJCO': '丘珠', 'RJCW': '稚内', 'RJEC': '旭川', 'RJEB': '�的别',
  // 韩国
  'RKSI': '仁川', 'RKSS': '金浦', 'RKPK': '金海', 'RKPC': '济州', 'RKTU': '清州',
  'RKTN': '大邱', 'RKJJ': '光州', 'RKJK': '群山', 'RKJY': '丽水', 'RKPU': '蔚山',
  'RKPS': '泗川', 'RKTH': '浦项', 'RKNY': '襄阳', 'RKPM': '务安',
  // 中国北方
  'ZBAA': '北京首都', 'ZBNY': '北京大兴', 'ZBTJ': '天津', 'ZBSJ': '石家庄',
  'ZYTX': '沈阳', 'ZYTL': '大连', 'ZYCC': '长春', 'ZYHB': '哈尔滨', 'ZYQQ': '齐齐哈尔',
  'ZSQD': '青岛', 'ZSYT': '烟台', 'ZSJN': '济南', 'ZSWD': '威海',
  // 中国华东
  'ZSPD': '上海浦东', 'ZSSS': '上海虹桥', 'ZSNJ': '南京', 'ZSHC': '杭州', 'ZSNB': '宁波',
  'ZSWZ': '温州', 'ZSAM': '厦门', 'ZSFZ': '福州', 'ZSOF': '合肥', 'ZSCN': '南昌',
  // 中国华南
  'ZGGG': '广州', 'ZGSZ': '深圳', 'ZGHA': '长沙', 'ZGNN': '南宁', 'ZGKL': '桂林',
  'ZGHC': '海口', 'ZJSY': '三亚', 'ZJHK': '海口美兰',
  // 中国西南
  'ZUUU': '成都双流', 'ZUTF': '成都天府', 'ZUCK': '重庆', 'ZPPP': '昆明', 'ZUGY': '贵阳',
  // 中国西北/中部
  'ZLXY': '西安', 'ZHCC': '郑州', 'ZWWW': '乌鲁木齐', 'ZLLL': '兰州', 'ZHWH': '武汉',
  // 港澳台
  'VHHH': '香港', 'VMMC': '澳门', 'RCTP': '台北桃园', 'RCSS': '台北松山',
  'RCKH': '高雄', 'RCMQ': '台中', 'RCNN': '台南',
  // 东南亚-泰国
  'VTBS': '曼谷素万那普', 'VTBD': '曼谷廊曼', 'VTSP': '普吉', 'VTCC': '清迈', 'VTSS': '苏梅',
  // 东南亚-越南
  'VVNB': '河内', 'VVTS': '胡志明', 'VVDN': '岘港', 'VVCI': '芽庄', 'VVPQ': '富国岛',
  // 东南亚-菲律宾
  'RPLL': '马尼拉', 'RPVM': '宿务', 'RPVB': '薄荷', 'RPVK': '卡利博',
  // 东南亚-印尼
  'WIII': '雅加达', 'WIDD': '棉兰', 'WADD': '巴厘岛', 'WARR': '泗水', 'WALL': '巴厘巴板',
  // 东南亚-马来西亚
  'WMKK': '吉隆坡', 'WBKK': '亚庇', 'WBGG': '古晋', 'WMKP': '槟城', 'WMKL': '浮罗交怡',
  // 东南亚-其他
  'WSSS': '新加坡', 'VDPP': '金边', 'VDSR': '暹粒', 'VLVT': '万象', 'VYYY': '仰光',
  // 南亚
  'VABB': '孟买', 'VIDP': '德里', 'VOBL': '班加罗尔', 'VCBI': '科伦坡', 'VNKT': '加德满都',
  // 中东
  'OMDB': '迪拜', 'OMAA': '阿布扎比', 'OTHH': '多哈', 'OERK': '利雅得', 'OEJN': '吉达',
  'LTFM': '伊斯坦布尔', 'LLBG': '特拉维夫',
  // 欧洲
  'EGLL': '伦敦希思罗', 'EGKK': '伦敦盖特威克', 'LFPG': '巴黎戴高乐', 'EDDF': '法兰克福',
  'EHAM': '阿姆斯特丹', 'LEMD': '马德里', 'LIRF': '罗马', 'LSZH': '苏黎世',
  'EBBR': '布鲁塞尔', 'EDDB': '柏林', 'EFHK': '赫尔辛基', 'EPWA': '华沙',
  // 北美
  'KJFK': '纽约JFK', 'KLAX': '洛杉矶', 'KSFO': '旧金山', 'KORD': '芝加哥',
  'KDEN': '丹佛', 'KSEA': '西雅图', 'KBOS': '波士顿', 'KIAH': '休斯顿',
  'PANC': '安克雷奇', 'PHNL': '檀香山', 'PGUM': '关岛', 'PGSN': '塞班',
  'CYVR': '温哥华', 'CYYZ': '多伦多', 'CYUL': '蒙特利尔',
  // 大洋洲
  'YSSY': '悉尼', 'YMML': '墨尔本', 'YBBN': '布里斯班', 'YPPH': '珀斯', 'YSCB': '凯恩斯',
  'NZAA': '奥克兰', 'NFFN': '楠迪', 'PTRO': '帕劳',
  // 其他
  'UUEE': '莫斯科', 'ZMUB': '乌兰巴托',
};

// 获取机场中文名称
function getAirportName(icao: string | null): string {
  if (!icao) return '';
  return AIRPORTS_NAME[icao] || icao;
}

// ICAO前缀到国家的映射（多语言）
const COUNTRY_BY_ICAO_PREFIX: Record<Language, Record<string, string>> = {
  zh: {
    'RJ': '日本', 'RO': '日本',  // 日本
    'RK': '韩国',  // 韩国
    'ZB': '中国', 'ZS': '中国', 'ZG': '中国', 'ZU': '中国', 'ZP': '中国', 'ZL': '中国', 'ZH': '中国', 'ZW': '中国', 'ZY': '中国', 'ZJ': '中国',  // 中国
    'VH': '香港', 'VM': '澳门', 'RC': '台湾',  // 港澳台
    'WS': '新加坡', 'VT': '泰国', 'VV': '越南', 'VD': '柬埔寨', 'VL': '老挝', 'VY': '缅甸',  // 东南亚
    'WM': '马来西亚', 'WB': '马来西亚', 'WI': '印尼', 'WA': '印尼', 'RP': '菲律宾',  // 东南亚
    'VA': '印度', 'VI': '印度', 'VO': '印度', 'VE': '印度', 'VC': '斯里兰卡', 'VN': '尼泊尔',  // 南亚
    'OM': '阿联酋', 'OT': '卡塔尔', 'OE': '沙特', 'OB': '巴林', 'OK': '科威特', 'OO': '阿曼',  // 中东
    'LT': '土耳其', 'LL': '以色列',  // 中东
    'EG': '英国', 'LF': '法国', 'ED': '德国', 'EH': '荷兰', 'EB': '比利时', 'LS': '瑞士',  // 欧洲
    'LE': '西班牙', 'LI': '意大利', 'EF': '芬兰', 'EP': '波兰', 'LO': '奥地利', 'LK': '捷克',  // 欧洲
    'K': '美国', 'PA': '美国', 'PH': '美国', 'PG': '美国',  // 美国及领地
    'CY': '加拿大',  // 加拿大
    'YS': '澳大利亚', 'YM': '澳大利亚', 'YB': '澳大利亚', 'YP': '澳大利亚', 'YC': '澳大利亚',  // 澳大利亚
    'NZ': '新西兰', 'NF': '斐济', 'PT': '帕劳',  // 大洋洲
    'UU': '俄罗斯', 'ZM': '蒙古',  // 其他
  },
  ja: {
    'RJ': '日本', 'RO': '日本',
    'RK': '韓国',
    'ZB': '中国', 'ZS': '中国', 'ZG': '中国', 'ZU': '中国', 'ZP': '中国', 'ZL': '中国', 'ZH': '中国', 'ZW': '中国', 'ZY': '中国', 'ZJ': '中国',
    'VH': '香港', 'VM': 'マカオ', 'RC': '台湾',
    'WS': 'シンガポール', 'VT': 'タイ', 'VV': 'ベトナム', 'VD': 'カンボジア', 'VL': 'ラオス', 'VY': 'ミャンマー',
    'WM': 'マレーシア', 'WB': 'マレーシア', 'WI': 'インドネシア', 'WA': 'インドネシア', 'RP': 'フィリピン',
    'VA': 'インド', 'VI': 'インド', 'VO': 'インド', 'VE': 'インド', 'VC': 'スリランカ', 'VN': 'ネパール',
    'OM': 'UAE', 'OT': 'カタール', 'OE': 'サウジ', 'OB': 'バーレーン', 'OK': 'クウェート', 'OO': 'オマーン',
    'LT': 'トルコ', 'LL': 'イスラエル',
    'EG': '英国', 'LF': 'フランス', 'ED': 'ドイツ', 'EH': 'オランダ', 'EB': 'ベルギー', 'LS': 'スイス',
    'LE': 'スペイン', 'LI': 'イタリア', 'EF': 'フィンランド', 'EP': 'ポーランド', 'LO': 'オーストリア', 'LK': 'チェコ',
    'K': '米国', 'PA': '米国', 'PH': '米国', 'PG': '米国',
    'CY': 'カナダ',
    'YS': '豪州', 'YM': '豪州', 'YB': '豪州', 'YP': '豪州', 'YC': '豪州',
    'NZ': 'NZ', 'NF': 'フィジー', 'PT': 'パラオ',
    'UU': 'ロシア', 'ZM': 'モンゴル',
  },
  en: {
    'RJ': 'Japan', 'RO': 'Japan',
    'RK': 'Korea',
    'ZB': 'China', 'ZS': 'China', 'ZG': 'China', 'ZU': 'China', 'ZP': 'China', 'ZL': 'China', 'ZH': 'China', 'ZW': 'China', 'ZY': 'China', 'ZJ': 'China',
    'VH': 'HK', 'VM': 'Macau', 'RC': 'Taiwan',
    'WS': 'Singapore', 'VT': 'Thailand', 'VV': 'Vietnam', 'VD': 'Cambodia', 'VL': 'Laos', 'VY': 'Myanmar',
    'WM': 'Malaysia', 'WB': 'Malaysia', 'WI': 'Indonesia', 'WA': 'Indonesia', 'RP': 'Philippines',
    'VA': 'India', 'VI': 'India', 'VO': 'India', 'VE': 'India', 'VC': 'Sri Lanka', 'VN': 'Nepal',
    'OM': 'UAE', 'OT': 'Qatar', 'OE': 'Saudi', 'OB': 'Bahrain', 'OK': 'Kuwait', 'OO': 'Oman',
    'LT': 'Turkey', 'LL': 'Israel',
    'EG': 'UK', 'LF': 'France', 'ED': 'Germany', 'EH': 'Netherlands', 'EB': 'Belgium', 'LS': 'Switzerland',
    'LE': 'Spain', 'LI': 'Italy', 'EF': 'Finland', 'EP': 'Poland', 'LO': 'Austria', 'LK': 'Czech',
    'K': 'USA', 'PA': 'USA', 'PH': 'USA', 'PG': 'USA',
    'CY': 'Canada',
    'YS': 'Australia', 'YM': 'Australia', 'YB': 'Australia', 'YP': 'Australia', 'YC': 'Australia',
    'NZ': 'NZ', 'NF': 'Fiji', 'PT': 'Palau',
    'UU': 'Russia', 'ZM': 'Mongolia',
  },
};

// 根据ICAO代码获取国家名称
function getCountryByIcao(icao: string | null, lang: Language): string {
  if (!icao || icao.length < 2) return '';

  const countryMap = COUNTRY_BY_ICAO_PREFIX[lang];

  // 先尝试匹配2字符前缀
  const prefix2 = icao.substring(0, 2);
  if (countryMap[prefix2]) {
    return countryMap[prefix2];
  }

  // 再尝试匹配1字符前缀（美国K开头）
  const prefix1 = icao.substring(0, 1);
  if (countryMap[prefix1]) {
    return countryMap[prefix1];
  }

  return '';
}

interface FlightListProps {
  title: string;
  flights: FlightInfo[] | Flight[];
  selectedFlight: Flight | null;
  onSelect: (flight: Flight | FlightInfo) => void;
  type: 'arrival' | 'departure';
  currentAirportIcao: string;
  flightRoutes?: Map<string, RouteInfo>;
}

export function FlightList({ title, flights, selectedFlight, onSelect, type, currentAirportIcao, flightRoutes }: FlightListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const middleItemRef = useRef<HTMLDivElement>(null);
  const { t, lang } = useLanguage();
  const [scale, setScale] = useState(1);

  // Ctrl + 滚轮缩放处理
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
      setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta)));
    }
  }, []);

  // 绑定 wheel 事件
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const isFlightInfo = (flight: FlightInfo | Flight | null | undefined): flight is FlightInfo => {
    return flight != null && typeof flight === 'object' && 'firstSeen' in flight;
  };

  // Sort flights by time (most recent first) and limit to 10
  const sortedFlights = useMemo(() => {
    if (!flights || flights.length === 0) return [];
    return [...flights]
      .filter(f => f != null)
      // 过滤无效的callsign（排除@等特殊字符）
      .filter(f => {
        const cs = f.callsign || f.icao24 || '';
        return isValidCallsign(cs) || /^[A-Fa-f0-9]+$/.test(cs); // 允许有效callsign或hex ICAO24
      })
      .sort((a, b) => {
      const aTime = isFlightInfo(a)
        ? (type === 'arrival' ? a.lastSeen : a.firstSeen)
        : a.lastContact;
      const bTime = isFlightInfo(b)
        ? (type === 'arrival' ? b.lastSeen : b.firstSeen)
        : b.lastContact;
      return bTime - aTime; // Descending order (most recent first)
    }).slice(0, 10); // 只显示最近10个航班
  }, [flights, type]);

  // Auto-scroll to show the most recent flight (first item) in the middle of visible area
  useEffect(() => {
    if (middleItemRef.current && listRef.current && sortedFlights.length > 0) {
      const listHeight = listRef.current.clientHeight;
      const itemTop = middleItemRef.current.offsetTop;
      const itemHeight = middleItemRef.current.clientHeight;
      // Scroll so that the first (most recent) item appears in the middle of the list
      const scrollPosition = itemTop - (listHeight / 2) + (itemHeight / 2);
      listRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [sortedFlights.length]);

  // Mark the first item (most recent) as the one to scroll to
  const mostRecentIndex = 0;

  return (
    <Container ref={containerRef}>
      <Header>
        <Title>{title}</Title>
        <HeaderRight>
          {scale !== 1 && <ScaleIndicator>{Math.round(scale * 100)}%</ScaleIndicator>}
          <Count>{sortedFlights.length}{flights.length > 10 ? ` / ${flights.length}` : ''}</Count>
        </HeaderRight>
      </Header>
      <List ref={listRef} $scale={scale}>
        {sortedFlights.length === 0 ? (
          <EmptyState>{type === 'arrival' ? t.noArrivals : t.noDepartures}</EmptyState>
        ) : (
          sortedFlights.map((flight, index) => {
            const isSelected = isFlightInfo(flight)
              ? selectedFlight?.icao24 === flight.icao24
              : selectedFlight?.icao24 === flight.icao24;
            const isMostRecent = index === mostRecentIndex;

            return (
              <ListItem
                key={isFlightInfo(flight) ? `${flight.icao24}-${index}` : flight.icao24}
                ref={isMostRecent ? middleItemRef : null}
                selected={isSelected}
                onClick={() => onSelect(flight)}
              >
                <FlightHeader>
                  <FlightInfoWrapper>
                    <Callsign>{flight.callsign || flight.icao24?.toUpperCase() || '-'}</Callsign>
                    {(() => {
                      // 支持多机场ICAO代码（如东京 RJTT/RJAA）
                      const airportIcaos = currentAirportIcao.split('/');
                      const isCurrentAirport = (icao: string | null) => icao ? airportIcaos.includes(icao) : false;

                      // 获取机场和国家信息的辅助函数
                      const formatAirportWithCountry = (icao: string) => {
                        const airport = getAirportName(icao);
                        const country = getCountryByIcao(icao, lang);
                        if (country && country !== airport) {
                          return `${airport} ${country}`;
                        }
                        return airport;
                      };

                      // 优先使用 OpenSky 的航线数据
                      if (isFlightInfo(flight)) {
                        if (type === 'arrival' && flight.estDepartureAirport && !isCurrentAirport(flight.estDepartureAirport)) {
                          const display = formatAirportWithCountry(flight.estDepartureAirport);
                          return <Route>（{display}）</Route>;
                        }
                        if (type === 'departure' && flight.estArrivalAirport && !isCurrentAirport(flight.estArrivalAirport)) {
                          const display = formatAirportWithCountry(flight.estArrivalAirport);
                          return <Route>（{display}）</Route>;
                        }
                      }
                      // 使用 HexDB.io 的航线数据
                      const callsign = flight.callsign?.trim();
                      const route = callsign ? flightRoutes?.get(callsign) : null;
                      if (route) {
                        if (type === 'arrival' && route.origin && !isCurrentAirport(route.origin)) {
                          const display = formatAirportWithCountry(route.origin);
                          return <Route>（{display}）</Route>;
                        }
                        if (type === 'departure' && route.destination && !isCurrentAirport(route.destination)) {
                          const display = formatAirportWithCountry(route.destination);
                          return <Route>（{display}）</Route>;
                        }
                      }
                      return null;
                    })()}
                    {getAirline(flight.callsign, lang) && (
                      <Airline>{getAirline(flight.callsign, lang)}</Airline>
                    )}
                  </FlightInfoWrapper>
                  {(() => {
                    // 优先显示机场爬虫的计划时间
                    const callsign = flight.callsign?.trim();
                    const route = callsign ? flightRoutes?.get(callsign) : null;
                    if (route?.scheduledTime) {
                      return (
                        <Time $hasSchedule={true}>
                          {route.scheduledTime}
                          {route.status && <Status $status={route.status}>{route.status}</Status>}
                        </Time>
                      );
                    }
                    // 回退到 ADS-B 时间戳
                    if (isFlightInfo(flight)) {
                      return (
                        <Time $hasSchedule={false}>
                          {type === 'arrival'
                            ? formatTime(flight.lastSeen)
                            : formatTime(flight.firstSeen)}
                        </Time>
                      );
                    }
                    return null;
                  })()}
                </FlightHeader>

                {!isFlightInfo(flight) && (
                  <Details>
                    <DetailItem>
                      {flight.altitude ? `${Math.round(flight.altitude)}${t.meter}` : t.ground}
                    </DetailItem>
                    <DetailItem>
                      {flight.velocity ? `${Math.round(flight.velocity * 3.6)}${t.kmPerHour}` : '-'}
                    </DetailItem>
                    {flight.originCountry && (
                      <DetailItem>{flight.originCountry}</DetailItem>
                    )}
                  </Details>
                )}
              </ListItem>
            );
          })
        )}
      </List>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, #0a0a12 0%, #0f0f1a 100%);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 255, 255, 0.15);
  background: linear-gradient(180deg, #0d0d18 0%, #0a0a12 100%);
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ScaleIndicator = styled.span`
  font-size: 10px;
  color: rgba(0, 255, 255, 0.5);
  font-family: 'Consolas', 'Monaco', monospace;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #00ffff;
  font-family: 'Consolas', 'Monaco', monospace;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
`;

const Count = styled.span`
  font-size: 12px;
  color: #00ffff;
  background: rgba(0, 255, 255, 0.1);
  border: 1px solid rgba(0, 255, 255, 0.3);
  padding: 4px 10px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const List = styled.div<{ $scale: number }>`
  flex: 1;
  overflow-y: auto;
  background: transparent;
  font-size: ${props => props.$scale}em;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 255, 255, 0.05);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 255, 0.3);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 255, 255, 0.5);
  }
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(0, 255, 255, 0.3);
  font-size: 0.8125em;  /* 13px -> em for scaling */
  font-family: 'Consolas', 'Monaco', monospace;
`;

const ListItem = styled.div<{ selected: boolean }>`
  padding: 0.625em 0.875em;  /* 10px 14px -> em for scaling */
  cursor: pointer;
  background: ${(props) => (props.selected
    ? 'linear-gradient(90deg, rgba(0, 255, 0, 0.15) 0%, rgba(0, 255, 0, 0.05) 100%)'
    : 'transparent')};
  border-bottom: 1px solid rgba(0, 255, 255, 0.08);
  border-left: 2px solid ${(props) => (props.selected ? '#00ff00' : 'transparent')};
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 255, 255, 0.05);
    border-left-color: rgba(0, 255, 255, 0.5);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const FlightHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5em;
`;

const FlightInfoWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25em;
  flex: 1;
  min-width: 0;
`;

const Callsign = styled.span`
  font-weight: 700;
  font-size: 0.875em;  /* 14px -> em for scaling */
  color: #ffffff;
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 1px;
`;

const Time = styled.div<{ $hasSchedule?: boolean }>`
  font-size: 0.75em;  /* 12px -> em for scaling */
  color: ${props => props.$hasSchedule ? '#00ff00' : 'rgba(0, 255, 255, 0.5)'};
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  text-shadow: ${props => props.$hasSchedule ? '0 0 5px rgba(0, 255, 0, 0.3)' : 'none'};
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
`;

const Status = styled.span<{ $status: string }>`
  font-size: 0.7em;
  padding: 1px 4px;
  border-radius: 2px;
  background: ${props => {
    const s = props.$status?.toLowerCase() || '';
    if (s.includes('出发') || s.includes('departed') || s.includes('離陸')) return 'rgba(0, 255, 0, 0.2)';
    if (s.includes('到达') || s.includes('arrived') || s.includes('着陸')) return 'rgba(0, 255, 255, 0.2)';
    if (s.includes('延误') || s.includes('delayed') || s.includes('遅延')) return 'rgba(255, 165, 0, 0.2)';
    if (s.includes('取消') || s.includes('cancelled') || s.includes('欠航')) return 'rgba(255, 0, 0, 0.2)';
    if (s.includes('登机') || s.includes('boarding') || s.includes('搭乗')) return 'rgba(255, 255, 0, 0.2)';
    return 'rgba(100, 100, 100, 0.2)';
  }};
  color: ${props => {
    const s = props.$status?.toLowerCase() || '';
    if (s.includes('出发') || s.includes('departed') || s.includes('離陸')) return '#00ff00';
    if (s.includes('到达') || s.includes('arrived') || s.includes('着陸')) return '#00ffff';
    if (s.includes('延误') || s.includes('delayed') || s.includes('遅延')) return '#ffa500';
    if (s.includes('取消') || s.includes('cancelled') || s.includes('欠航')) return '#ff6666';
    if (s.includes('登机') || s.includes('boarding') || s.includes('搭乗')) return '#ffff00';
    return '#888888';
  }};
`;

const Route = styled.span`
  font-size: 0.75em;  /* 12px -> em for scaling */
  color: rgba(0, 255, 255, 0.6);
`;

const Airline = styled.span`
  font-size: 0.6875em;  /* 11px -> em for scaling */
  color: rgba(255, 255, 255, 0.5);
`;

const Details = styled.div`
  display: flex;
  gap: 0.75em;
  margin-top: 0.25em;
`;

const DetailItem = styled.div`
  font-size: 0.6875em;  /* 11px -> em for scaling */
  color: rgba(0, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 0.25em;
  font-family: 'Consolas', 'Monaco', monospace;

  &::before {
    content: '';
    width: 0.2em;
    height: 0.2em;
    background: #00ffff;
    border-radius: 50%;
    box-shadow: 0 0 4px #00ffff;
  }
`;

