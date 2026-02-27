import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import styled from 'styled-components';
import type { Flight } from '../types/flight';
import type { RouteInfo, ScheduledFlight } from '../context/FlightContext';
import { useLanguage } from '../context/LanguageContext';

// 缩放范围配置
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;

// 航空公司代码多语言映射
type Language = 'zh' | 'ja' | 'en';

// 机场IATA代码 -> 国家名称映射（多语言）
const COUNTRY_BY_AIRPORT: Record<Language, Record<string, string>> = {
  zh: {
    // 日本
    'FUK': '日本', 'HND': '日本', 'NRT': '日本', 'KIX': '日本', 'ITM': '日本',
    'NGO': '日本', 'CTS': '日本', 'OKA': '日本', 'KOJ': '日本', 'KMQ': '日本',
    'SDJ': '日本', 'HIJ': '日本', 'MYJ': '日本', 'TAK': '日本', 'KMI': '日本',
    'NGS': '日本', 'OIT': '日本', 'KKJ': '日本', 'FKS': '日本', 'KCZ': '日本',
    // 韩国
    'ICN': '韩国', 'GMP': '韩国', 'PUS': '韩国', 'CJU': '韩国', 'TAE': '韩国',
    'KWJ': '韩国', 'RSU': '韩国', 'USN': '韩国', 'MWX': '韩国', 'YNY': '韩国',
    // 中国大陆
    'PEK': '中国', 'PKX': '中国', 'PVG': '中国', 'SHA': '中国', 'CAN': '中国',
    'SZX': '中国', 'CTU': '中国', 'XIY': '中国', 'WUH': '中国', 'NKG': '中国',
    'HGH': '中国', 'TSN': '中国', 'SHE': '中国', 'DLC': '中国', 'TAO': '中国',
    'CGO': '中国', 'CSX': '中国', 'XMN': '中国', 'FOC': '中国', 'KMG': '中国',
    'NNG': '中国', 'HAK': '中国', 'SYX': '中国', 'CGQ': '中国', 'HRB': '中国',
    // 港澳台
    'HKG': '香港', 'MFM': '澳门', 'TPE': '台湾', 'TSA': '台湾', 'KHH': '台湾', 'RMQ': '台湾',
    // 东南亚
    'SIN': '新加坡', 'BKK': '泰国', 'DMK': '泰国', 'CNX': '泰国', 'HKT': '泰国',
    'KUL': '马来西亚', 'PEN': '马来西亚', 'LGK': '马来西亚', 'JHB': '马来西亚',
    'SGN': '越南', 'HAN': '越南', 'DAD': '越南', 'CXR': '越南',
    'MNL': '菲律宾', 'CEB': '菲律宾',
    'CGK': '印尼', 'DPS': '印尼',
    'RGN': '缅甸', 'PNH': '柬埔寨', 'VTE': '老挝',
    // 南亚
    'DEL': '印度', 'BOM': '印度', 'BLR': '印度', 'MAA': '印度', 'CCU': '印度',
    'CMB': '斯里兰卡', 'MLE': '马尔代夫', 'DAC': '孟加拉',
    // 中东
    'DXB': '阿联酋', 'AUH': '阿联酋', 'DOH': '卡塔尔', 'IST': '土耳其',
    // 欧洲
    'LHR': '英国', 'CDG': '法国', 'FRA': '德国', 'MUC': '德国', 'AMS': '荷兰',
    'FCO': '意大利', 'MXP': '意大利', 'MAD': '西班牙', 'BCN': '西班牙',
    'ZRH': '瑞士', 'VIE': '奥地利', 'HEL': '芬兰', 'SVO': '俄罗斯',
    // 北美
    'LAX': '美国', 'SFO': '美国', 'JFK': '美国', 'ORD': '美国', 'SEA': '美国',
    'DFW': '美国', 'ATL': '美国', 'IAD': '美国', 'HNL': '美国',
    'YVR': '加拿大', 'YYZ': '加拿大',
    // 大洋洲
    'SYD': '澳大利亚', 'MEL': '澳大利亚', 'BNE': '澳大利亚', 'PER': '澳大利亚',
    'AKL': '新西兰', 'GUM': '关岛', 'SPN': '塞班',
  },
  ja: {
    // 日本
    'FUK': '日本', 'HND': '日本', 'NRT': '日本', 'KIX': '日本', 'ITM': '日本',
    'NGO': '日本', 'CTS': '日本', 'OKA': '日本', 'KOJ': '日本', 'KMQ': '日本',
    'SDJ': '日本', 'HIJ': '日本', 'MYJ': '日本', 'TAK': '日本', 'KMI': '日本',
    'NGS': '日本', 'OIT': '日本', 'KKJ': '日本', 'FKS': '日本', 'KCZ': '日本',
    // 韓国
    'ICN': '韓国', 'GMP': '韓国', 'PUS': '韓国', 'CJU': '韓国', 'TAE': '韓国',
    'KWJ': '韓国', 'RSU': '韓国', 'USN': '韓国', 'MWX': '韓国', 'YNY': '韓国',
    // 中国本土
    'PEK': '中国', 'PKX': '中国', 'PVG': '中国', 'SHA': '中国', 'CAN': '中国',
    'SZX': '中国', 'CTU': '中国', 'XIY': '中国', 'WUH': '中国', 'NKG': '中国',
    'HGH': '中国', 'TSN': '中国', 'SHE': '中国', 'DLC': '中国', 'TAO': '中国',
    'CGO': '中国', 'CSX': '中国', 'XMN': '中国', 'FOC': '中国', 'KMG': '中国',
    'NNG': '中国', 'HAK': '中国', 'SYX': '中国', 'CGQ': '中国', 'HRB': '中国',
    // 港澳台
    'HKG': '香港', 'MFM': 'マカオ', 'TPE': '台湾', 'TSA': '台湾', 'KHH': '台湾', 'RMQ': '台湾',
    // 東南アジア
    'SIN': 'シンガポール', 'BKK': 'タイ', 'DMK': 'タイ', 'CNX': 'タイ', 'HKT': 'タイ',
    'KUL': 'マレーシア', 'PEN': 'マレーシア', 'LGK': 'マレーシア', 'JHB': 'マレーシア',
    'SGN': 'ベトナム', 'HAN': 'ベトナム', 'DAD': 'ベトナム', 'CXR': 'ベトナム',
    'MNL': 'フィリピン', 'CEB': 'フィリピン',
    'CGK': 'インドネシア', 'DPS': 'インドネシア',
    'RGN': 'ミャンマー', 'PNH': 'カンボジア', 'VTE': 'ラオス',
    // 南アジア
    'DEL': 'インド', 'BOM': 'インド', 'BLR': 'インド', 'MAA': 'インド', 'CCU': 'インド',
    'CMB': 'スリランカ', 'MLE': 'モルディブ', 'DAC': 'バングラデシュ',
    // 中東
    'DXB': 'UAE', 'AUH': 'UAE', 'DOH': 'カタール', 'IST': 'トルコ',
    // ヨーロッパ
    'LHR': '英国', 'CDG': 'フランス', 'FRA': 'ドイツ', 'MUC': 'ドイツ', 'AMS': 'オランダ',
    'FCO': 'イタリア', 'MXP': 'イタリア', 'MAD': 'スペイン', 'BCN': 'スペイン',
    'ZRH': 'スイス', 'VIE': 'オーストリア', 'HEL': 'フィンランド', 'SVO': 'ロシア',
    // 北米
    'LAX': 'アメリカ', 'SFO': 'アメリカ', 'JFK': 'アメリカ', 'ORD': 'アメリカ', 'SEA': 'アメリカ',
    'DFW': 'アメリカ', 'ATL': 'アメリカ', 'IAD': 'アメリカ', 'HNL': 'アメリカ',
    'YVR': 'カナダ', 'YYZ': 'カナダ',
    // オセアニア
    'SYD': 'オーストラリア', 'MEL': 'オーストラリア', 'BNE': 'オーストラリア', 'PER': 'オーストラリア',
    'AKL': 'ニュージーランド', 'GUM': 'グアム', 'SPN': 'サイパン',
  },
  en: {
    // Japan
    'FUK': 'Japan', 'HND': 'Japan', 'NRT': 'Japan', 'KIX': 'Japan', 'ITM': 'Japan',
    'NGO': 'Japan', 'CTS': 'Japan', 'OKA': 'Japan', 'KOJ': 'Japan', 'KMQ': 'Japan',
    'SDJ': 'Japan', 'HIJ': 'Japan', 'MYJ': 'Japan', 'TAK': 'Japan', 'KMI': 'Japan',
    'NGS': 'Japan', 'OIT': 'Japan', 'KKJ': 'Japan', 'FKS': 'Japan', 'KCZ': 'Japan',
    // Korea
    'ICN': 'Korea', 'GMP': 'Korea', 'PUS': 'Korea', 'CJU': 'Korea', 'TAE': 'Korea',
    'KWJ': 'Korea', 'RSU': 'Korea', 'USN': 'Korea', 'MWX': 'Korea', 'YNY': 'Korea',
    // China
    'PEK': 'China', 'PKX': 'China', 'PVG': 'China', 'SHA': 'China', 'CAN': 'China',
    'SZX': 'China', 'CTU': 'China', 'XIY': 'China', 'WUH': 'China', 'NKG': 'China',
    'HGH': 'China', 'TSN': 'China', 'SHE': 'China', 'DLC': 'China', 'TAO': 'China',
    'CGO': 'China', 'CSX': 'China', 'XMN': 'China', 'FOC': 'China', 'KMG': 'China',
    'NNG': 'China', 'HAK': 'China', 'SYX': 'China', 'CGQ': 'China', 'HRB': 'China',
    // HK/Macau/Taiwan
    'HKG': 'Hong Kong', 'MFM': 'Macau', 'TPE': 'Taiwan', 'TSA': 'Taiwan', 'KHH': 'Taiwan', 'RMQ': 'Taiwan',
    // Southeast Asia
    'SIN': 'Singapore', 'BKK': 'Thailand', 'DMK': 'Thailand', 'CNX': 'Thailand', 'HKT': 'Thailand',
    'KUL': 'Malaysia', 'PEN': 'Malaysia', 'LGK': 'Malaysia', 'JHB': 'Malaysia',
    'SGN': 'Vietnam', 'HAN': 'Vietnam', 'DAD': 'Vietnam', 'CXR': 'Vietnam',
    'MNL': 'Philippines', 'CEB': 'Philippines',
    'CGK': 'Indonesia', 'DPS': 'Indonesia',
    'RGN': 'Myanmar', 'PNH': 'Cambodia', 'VTE': 'Laos',
    // South Asia
    'DEL': 'India', 'BOM': 'India', 'BLR': 'India', 'MAA': 'India', 'CCU': 'India',
    'CMB': 'Sri Lanka', 'MLE': 'Maldives', 'DAC': 'Bangladesh',
    // Middle East
    'DXB': 'UAE', 'AUH': 'UAE', 'DOH': 'Qatar', 'IST': 'Turkey',
    // Europe
    'LHR': 'UK', 'CDG': 'France', 'FRA': 'Germany', 'MUC': 'Germany', 'AMS': 'Netherlands',
    'FCO': 'Italy', 'MXP': 'Italy', 'MAD': 'Spain', 'BCN': 'Spain',
    'ZRH': 'Switzerland', 'VIE': 'Austria', 'HEL': 'Finland', 'SVO': 'Russia',
    // North America
    'LAX': 'USA', 'SFO': 'USA', 'JFK': 'USA', 'ORD': 'USA', 'SEA': 'USA',
    'DFW': 'USA', 'ATL': 'USA', 'IAD': 'USA', 'HNL': 'USA',
    'YVR': 'Canada', 'YYZ': 'Canada',
    // Oceania
    'SYD': 'Australia', 'MEL': 'Australia', 'BNE': 'Australia', 'PER': 'Australia',
    'AKL': 'New Zealand', 'GUM': 'Guam', 'SPN': 'Saipan',
  },
};

// 根据机场IATA代码获取国家名称
function getCountryByAirport(iata: string | undefined, lang: Language): string {
  if (!iata) return '';
  const code = iata.toUpperCase();
  return COUNTRY_BY_AIRPORT[lang][code] || COUNTRY_BY_AIRPORT.en[code] || '';
}

const AIRLINES: Record<Language, Record<string, string>> = {
  zh: {
    // 日本 - ICAO + IATA
    'JAL': '日本航空', 'JL': '日本航空',
    'ANA': '全日空', 'NH': '全日空',
    'JJP': '捷星日本', 'GK': '捷星日本',
    'APJ': '乐桃航空', 'MM': '乐桃航空',
    'SFJ': '星悦航空', '7G': '星悦航空',
    'SKY': '天马航空', 'BC': '天马航空',
    'ADO': '北海道航空', 'HD': '北海道航空',
    'SNA': '索拉西德航空', '6J': '索拉西德航空',
    'IBX': 'IBEX航空', 'FW': 'IBEX航空',
    'ORC': '东方空桥', 'OC': '东方空桥',
    'NCA': '日本货航', 'KZ': '日本货航',
    'FDA': '富士梦幻航空', 'JH': '富士梦幻航空',
    // 韩国 - ICAO + IATA
    'KAL': '大韩航空', 'KE': '大韩航空',
    'AAR': '韩亚航空', 'OZ': '韩亚航空',
    'JNA': '真航空', 'LJ': '真航空',
    'TWB': '德威航空', 'TW': '德威航空',
    'ABL': '釜山航空', 'BX': '釜山航空',
    'JJA': '济州航空', '7C': '济州航空',
    'ESR': '易斯达航空', 'ZE': '易斯达航空',
    // 中国 - ICAO + IATA
    'CCA': '中国国航', 'CA': '中国国航',
    'CES': '东方航空', 'MU': '东方航空',
    'CSN': '南方航空', 'CZ': '南方航空',
    'CHH': '海南航空', 'HU': '海南航空',
    'CSC': '四川航空', '3U': '四川航空',
    'CXA': '厦门航空', 'MF': '厦门航空',
    'CSZ': '深圳航空', 'ZH': '深圳航空',
    'CQH': '春秋航空', '9C': '春秋航空',
    'DKH': '吉祥航空', 'HO': '吉祥航空',
    'CDG': '山东航空', 'SC': '山东航空',
    'GCR': '天津航空', 'GS': '天津航空',
    // 港澳台 - ICAO + IATA
    'EVA': '长荣航空', 'BR': '长荣航空',
    'CAL': '中华航空', 'CI': '中华航空',
    'TGW': '台湾虎航', 'IT': '台湾虎航',
    'CPA': '国泰航空', 'CX': '国泰航空',
    'HKE': '香港快运', 'UO': '香港快运',
    'NMG': '澳门航空', 'NX': '澳门航空',
    'HXA': '香港航空', 'HX': '香港航空',
    // 东南亚 - ICAO + IATA
    'SIA': '新加坡航空', 'SQ': '新加坡航空',
    'VJC': '越捷航空', 'VJ': '越捷航空',
    'HVN': '越南航空', 'VN': '越南航空',
    'THA': '泰国航空', 'TG': '泰国航空',
    'MAS': '马来西亚航空', 'MH': '马来西亚航空',
    'AXM': '亚洲航空', 'AK': '亚洲航空',
    'GIA': '印尼鹰航', 'GA': '印尼鹰航',
    'CEB': '宿务太平洋', '5J': '宿务太平洋',
    'PAL': '菲律宾航空', 'PR': '菲律宾航空',
    'BKP': '曼谷航空', 'PG': '曼谷航空',
    'SJY': '酷航', 'TR': '酷航',
    // 中东 - ICAO + IATA
    'UAE': '阿联酋航空', 'EK': '阿联酋航空',
    'ETD': '阿提哈德航空', 'EY': '阿提哈德航空',
    'QTR': '卡塔尔航空', 'QR': '卡塔尔航空',
    'THY': '土耳其航空', 'TK': '土耳其航空',
    // 欧美 - ICAO + IATA
    'DLH': '汉莎航空', 'LH': '汉莎航空',
    'BAW': '英国航空', 'BA': '英国航空',
    'AFR': '法国航空', 'AF': '法国航空',
    'KLM': '荷兰皇家航空', 'KL': '荷兰皇家航空',
    'AAL': '美国航空', 'AA': '美国航空',
    'UAL': '美联航', 'UA': '美联航',
    'DAL': '达美航空', 'DL': '达美航空',
    'SWA': '西南航空', 'WN': '西南航空',
    'ACA': '加拿大航空', 'AC': '加拿大航空',
    'QFA': '澳洲航空', 'QF': '澳洲航空',
    'ANZ': '新西兰航空', 'NZ': '新西兰航空',
    // 货运 - ICAO + IATA
    'FDX': '联邦快递', 'FX': '联邦快递',
    'UPS': 'UPS航空', '5X': 'UPS航空',
    'GTI': '极地航空', 'PO': '极地航空',
    // 其他 - ICAO + IATA
    'AFL': '俄罗斯航空', 'SU': '俄罗斯航空',
    'ETH': '埃塞俄比亚航空', 'ET': '埃塞俄比亚航空',
  },
  ja: {
    // 日本 - ICAO + IATA
    'JAL': '日本航空', 'JL': '日本航空',
    'ANA': '全日空', 'NH': '全日空',
    'JJP': 'ジェットスター', 'GK': 'ジェットスター',
    'APJ': 'ピーチ', 'MM': 'ピーチ',
    'SFJ': 'スターフライヤー', '7G': 'スターフライヤー',
    'SKY': 'スカイマーク', 'BC': 'スカイマーク',
    'ADO': 'エア・ドゥ', 'HD': 'エア・ドゥ',
    'SNA': 'ソラシドエア', '6J': 'ソラシドエア',
    'IBX': 'IBEX', 'FW': 'IBEX',
    'ORC': 'オリエンタルエア', 'OC': 'オリエンタルエア',
    'NCA': '日本貨物航空', 'KZ': '日本貨物航空',
    'FDA': 'フジドリーム', 'JH': 'フジドリーム',
    // 韓国 - ICAO + IATA
    'KAL': '大韓航空', 'KE': '大韓航空',
    'AAR': 'アシアナ航空', 'OZ': 'アシアナ航空',
    'JNA': 'ジンエアー', 'LJ': 'ジンエアー',
    'TWB': 'ティーウェイ航空', 'TW': 'ティーウェイ航空',
    'ABL': 'エアプサン', 'BX': 'エアプサン',
    'JJA': 'チェジュ航空', '7C': 'チェジュ航空',
    'ESR': 'イースター航空', 'ZE': 'イースター航空',
    // 中国 - ICAO + IATA
    'CCA': '中国国際航空', 'CA': '中国国際航空',
    'CES': '中国東方航空', 'MU': '中国東方航空',
    'CSN': '中国南方航空', 'CZ': '中国南方航空',
    'CHH': '海南航空', 'HU': '海南航空',
    'CSC': '四川航空', '3U': '四川航空',
    'CXA': '厦門航空', 'MF': '厦門航空',
    'CSZ': '深セン航空', 'ZH': '深セン航空',
    'CQH': '春秋航空', '9C': '春秋航空',
    'DKH': '吉祥航空', 'HO': '吉祥航空',
    'CDG': '山東航空', 'SC': '山東航空',
    'GCR': '天津航空', 'GS': '天津航空',
    // 港澳台 - ICAO + IATA
    'EVA': 'エバー航空', 'BR': 'エバー航空',
    'CAL': 'チャイナエア', 'CI': 'チャイナエア',
    'TGW': 'タイガーエア台湾', 'IT': 'タイガーエア台湾',
    'CPA': 'キャセイパシフィック', 'CX': 'キャセイパシフィック',
    'HKE': '香港エクスプレス', 'UO': '香港エクスプレス',
    'NMG': 'マカオ航空', 'NX': 'マカオ航空',
    'HXA': '香港航空', 'HX': '香港航空',
    // 東南アジア - ICAO + IATA
    'SIA': 'シンガポール航空', 'SQ': 'シンガポール航空',
    'VJC': 'ベトジェット', 'VJ': 'ベトジェット',
    'HVN': 'ベトナム航空', 'VN': 'ベトナム航空',
    'THA': 'タイ国際航空', 'TG': 'タイ国際航空',
    'MAS': 'マレーシア航空', 'MH': 'マレーシア航空',
    'AXM': 'エアアジア', 'AK': 'エアアジア',
    'GIA': 'ガルーダ', 'GA': 'ガルーダ',
    'CEB': 'セブパシフィック', '5J': 'セブパシフィック',
    'PAL': 'フィリピン航空', 'PR': 'フィリピン航空',
    'BKP': 'バンコクエアウェイズ', 'PG': 'バンコクエアウェイズ',
    'SJY': 'スクート', 'TR': 'スクート',
    // 中東 - ICAO + IATA
    'UAE': 'エミレーツ', 'EK': 'エミレーツ',
    'ETD': 'エティハド', 'EY': 'エティハド',
    'QTR': 'カタール航空', 'QR': 'カタール航空',
    'THY': 'ターキッシュ', 'TK': 'ターキッシュ',
    // 欧米 - ICAO + IATA
    'DLH': 'ルフトハンザ', 'LH': 'ルフトハンザ',
    'BAW': 'ブリティッシュ', 'BA': 'ブリティッシュ',
    'AFR': 'エールフランス', 'AF': 'エールフランス',
    'KLM': 'KLM', 'KL': 'KLM',
    'AAL': 'アメリカン', 'AA': 'アメリカン',
    'UAL': 'ユナイテッド', 'UA': 'ユナイテッド',
    'DAL': 'デルタ', 'DL': 'デルタ',
    'SWA': 'サウスウエスト', 'WN': 'サウスウエスト',
    'ACA': 'エアカナダ', 'AC': 'エアカナダ',
    'QFA': 'カンタス', 'QF': 'カンタス',
    'ANZ': 'ニュージーランド航空', 'NZ': 'ニュージーランド航空',
    // 貨物 - ICAO + IATA
    'FDX': 'フェデックス', 'FX': 'フェデックス',
    'UPS': 'UPS', '5X': 'UPS',
    'GTI': 'ポーラーエア', 'PO': 'ポーラーエア',
    // その他 - ICAO + IATA
    'AFL': 'アエロフロート', 'SU': 'アエロフロート',
    'ETH': 'エチオピア航空', 'ET': 'エチオピア航空',
  },
  en: {
    // Japan - ICAO + IATA
    'JAL': 'Japan Airlines', 'JL': 'Japan Airlines',
    'ANA': 'All Nippon Airways', 'NH': 'All Nippon Airways',
    'JJP': 'Jetstar Japan', 'GK': 'Jetstar Japan',
    'APJ': 'Peach Aviation', 'MM': 'Peach Aviation',
    'SFJ': 'Star Flyer', '7G': 'Star Flyer',
    'SKY': 'Skymark', 'BC': 'Skymark',
    'ADO': 'Air Do', 'HD': 'Air Do',
    'SNA': 'Solaseed Air', '6J': 'Solaseed Air',
    'IBX': 'IBEX Airlines', 'FW': 'IBEX Airlines',
    'ORC': 'Oriental Air Bridge', 'OC': 'Oriental Air Bridge',
    'NCA': 'Nippon Cargo', 'KZ': 'Nippon Cargo',
    'FDA': 'Fuji Dream', 'JH': 'Fuji Dream',
    // Korea - ICAO + IATA
    'KAL': 'Korean Air', 'KE': 'Korean Air',
    'AAR': 'Asiana Airlines', 'OZ': 'Asiana Airlines',
    'JNA': 'Jin Air', 'LJ': 'Jin Air',
    'TWB': 'T\'way Air', 'TW': 'T\'way Air',
    'ABL': 'Air Busan', 'BX': 'Air Busan',
    'JJA': 'Jeju Air', '7C': 'Jeju Air',
    'ESR': 'Eastar Jet', 'ZE': 'Eastar Jet',
    // China - ICAO + IATA
    'CCA': 'Air China', 'CA': 'Air China',
    'CES': 'China Eastern', 'MU': 'China Eastern',
    'CSN': 'China Southern', 'CZ': 'China Southern',
    'CHH': 'Hainan Airlines', 'HU': 'Hainan Airlines',
    'CSC': 'Sichuan Airlines', '3U': 'Sichuan Airlines',
    'CXA': 'Xiamen Air', 'MF': 'Xiamen Air',
    'CSZ': 'Shenzhen Airlines', 'ZH': 'Shenzhen Airlines',
    'CQH': 'Spring Airlines', '9C': 'Spring Airlines',
    'DKH': 'Juneyao Airlines', 'HO': 'Juneyao Airlines',
    'CDG': 'Shandong Airlines', 'SC': 'Shandong Airlines',
    'GCR': 'Tianjin Airlines', 'GS': 'Tianjin Airlines',
    // Taiwan/HK/Macau - ICAO + IATA
    'EVA': 'EVA Air', 'BR': 'EVA Air',
    'CAL': 'China Airlines', 'CI': 'China Airlines',
    'TGW': 'Tigerair Taiwan', 'IT': 'Tigerair Taiwan',
    'CPA': 'Cathay Pacific', 'CX': 'Cathay Pacific',
    'HKE': 'HK Express', 'UO': 'HK Express',
    'NMG': 'Air Macau', 'NX': 'Air Macau',
    'HXA': 'Hong Kong Airlines', 'HX': 'Hong Kong Airlines',
    // Southeast Asia - ICAO + IATA
    'SIA': 'Singapore Airlines', 'SQ': 'Singapore Airlines',
    'VJC': 'VietJet Air', 'VJ': 'VietJet Air',
    'HVN': 'Vietnam Airlines', 'VN': 'Vietnam Airlines',
    'THA': 'Thai Airways', 'TG': 'Thai Airways',
    'MAS': 'Malaysia Airlines', 'MH': 'Malaysia Airlines',
    'AXM': 'AirAsia', 'AK': 'AirAsia',
    'GIA': 'Garuda Indonesia', 'GA': 'Garuda Indonesia',
    'CEB': 'Cebu Pacific', '5J': 'Cebu Pacific',
    'PAL': 'Philippine Airlines', 'PR': 'Philippine Airlines',
    'BKP': 'Bangkok Airways', 'PG': 'Bangkok Airways',
    'SJY': 'Scoot', 'TR': 'Scoot',
    // Middle East - ICAO + IATA
    'UAE': 'Emirates', 'EK': 'Emirates',
    'ETD': 'Etihad Airways', 'EY': 'Etihad Airways',
    'QTR': 'Qatar Airways', 'QR': 'Qatar Airways',
    'THY': 'Turkish Airlines', 'TK': 'Turkish Airlines',
    // Europe/Americas - ICAO + IATA
    'DLH': 'Lufthansa', 'LH': 'Lufthansa',
    'BAW': 'British Airways', 'BA': 'British Airways',
    'AFR': 'Air France', 'AF': 'Air France',
    'KLM': 'KLM', 'KL': 'KLM',
    'AAL': 'American Airlines', 'AA': 'American Airlines',
    'UAL': 'United Airlines', 'UA': 'United Airlines',
    'DAL': 'Delta Air Lines', 'DL': 'Delta Air Lines',
    'SWA': 'Southwest', 'WN': 'Southwest',
    'ACA': 'Air Canada', 'AC': 'Air Canada',
    'QFA': 'Qantas', 'QF': 'Qantas',
    'ANZ': 'Air New Zealand', 'NZ': 'Air New Zealand',
    // Cargo - ICAO + IATA
    'FDX': 'FedEx Express', 'FX': 'FedEx Express',
    'UPS': 'UPS Airlines', '5X': 'UPS Airlines',
    'GTI': 'Polar Air Cargo', 'PO': 'Polar Air Cargo',
    // Other - ICAO + IATA
    'AFL': 'Aeroflot', 'SU': 'Aeroflot',
    'ETH': 'Ethiopian Airlines', 'ET': 'Ethiopian Airlines',
  },
};

// 验证callsign是否有效（只包含字母数字）
function isValidCallsign(callsign: string | null): boolean {
  if (!callsign) return false;
  // 只允许字母、数字、空格
  return /^[A-Za-z0-9\s]+$/.test(callsign);
}

// 规范化callsign格式（去掉空格，转大写）- 用于匹配flightRoutes
function normalizeCallsign(callsign: string | null | undefined): string | null {
  if (!callsign) return null;
  return callsign.trim().replace(/\s+/g, '').toUpperCase();
}

// 从callsign提取航空公司（多语言）
function getAirline(callsign: string | null, lang: Language): string {
  if (!callsign || !isValidCallsign(callsign)) return '';
  const code = callsign.replace(/[0-9]/g, '').trim();
  return AIRLINES[lang][code] || AIRLINES.en[code] || code;
}

interface FlightListProps {
  title: string;
  flights: ScheduledFlight[];  // 使用时刻表数据
  selectedFlight: Flight | null;
  onSelect: (flight: ScheduledFlight) => void;
  type: 'arrival' | 'departure';
  currentAirportIcao: string;
  flightRoutes?: Map<string, RouteInfo>;
}

export function FlightList({ title, flights, selectedFlight, onSelect, type, currentAirportIcao: _currentAirportIcao, flightRoutes: _flightRoutes }: FlightListProps) {
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

  // 解析时间字符串 "HH:MM" 为分钟数（用于排序）
  const parseTimeToMinutes = (timeStr: string | null | undefined): number | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return null;
  };

  // 获取当前日本时间的分钟数
  const getCurrentMinutes = useCallback(() => {
    const now = new Date();
    const japanOffset = 9 * 60; // UTC+9
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    return (utcMinutes + japanOffset) % (24 * 60);
  }, []);

  // 按计划时间排序，当前时间附近的航班排在第3位（索引2）
  const sortedFlights = useMemo(() => {
    if (!flights || flights.length === 0) return [];

    const currentMinutes = getCurrentMinutes();

    // 先过滤和排序所有航班
    const allFlights = [...flights]
      .filter(f => f != null && f.flightNumber)
      .filter(f => {
        const fn = (f.flightNumber || '').replace(/\s+/g, '').trim();
        // 航班号必须至少2个字符且包含字母和数字
        return fn.length >= 2 && /[A-Za-z]/.test(fn) && /[0-9]/.test(fn);
      })
      .sort((a, b) => {
        const aScheduledMinutes = parseTimeToMinutes(a.scheduledTime);
        const bScheduledMinutes = parseTimeToMinutes(b.scheduledTime);

        if (aScheduledMinutes !== null && bScheduledMinutes !== null) {
          return aScheduledMinutes - bScheduledMinutes;
        }

        if (aScheduledMinutes !== null && bScheduledMinutes === null) return -1;
        if (aScheduledMinutes === null && bScheduledMinutes !== null) return 1;

        return (a.flightNumber || '').localeCompare(b.flightNumber || '');
      });

    // 找到第一个计划时间 >= 当前时间的航班索引
    let nextFlightIdx = allFlights.findIndex(f => {
      const scheduledMinutes = parseTimeToMinutes(f.scheduledTime);
      return scheduledMinutes !== null && scheduledMinutes >= currentMinutes;
    });

    // 如果没找到（所有航班都已过去），显示最后几班
    if (nextFlightIdx === -1) {
      nextFlightIdx = Math.max(0, allFlights.length - 3);
    }

    // 重新排列：当前时间最近的航班放在第3位（索引2）
    // 前面放2个已过去的航班，后面放即将到来的航班
    const targetPosition = 2; // 第3位 = 索引2
    const startIdx = Math.max(0, nextFlightIdx - targetPosition);

    // 截取从startIdx开始的10个航班
    return allFlights.slice(startIdx, startIdx + 10);
  }, [flights, getCurrentMinutes]);

  // 找到"最近即将到达/出发"的航班索引
  // sortedFlights已经将当前时间最近的航班放在第3位附近
  const nextFlightIndex = useMemo(() => {
    const currentMinutes = getCurrentMinutes();

    // 在sortedFlights中找到第一个计划时间 >= 当前时间的航班
    for (let i = 0; i < sortedFlights.length; i++) {
      const flight = sortedFlights[i];
      const scheduledMinutes = parseTimeToMinutes(flight.scheduledTime);

      if (scheduledMinutes !== null && scheduledMinutes >= currentMinutes) {
        return i;
      }
    }
    // 如果都已过去，最后一个有效
    return sortedFlights.length > 0 ? sortedFlights.length - 1 : -1;
  }, [sortedFlights, getCurrentMinutes]);

  // 标记需要滚动到的航班索引（当前时间最近的航班）
  const scrollToIndex = nextFlightIndex;

  // Auto-scroll to show the next flight in the visible area
  useEffect(() => {
    if (middleItemRef.current && listRef.current && sortedFlights.length > 0) {
      const listHeight = listRef.current.clientHeight;
      const itemTop = middleItemRef.current.offsetTop;
      const itemHeight = middleItemRef.current.clientHeight;
      // 滚动使标记的航班可见
      const scrollPosition = itemTop - (listHeight / 2) + (itemHeight / 2);
      listRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [sortedFlights.length, nextFlightIndex]);

  // 飞机图标 SVG（用于图例）
  const planeIconSvg = (color: string, size: number = 16) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ verticalAlign: 'middle' }}>
      <path d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
    </svg>
  );

  return (
    <Container ref={containerRef}>
      <Header>
        <TitleRow>
          <Title>{title}</Title>
          <IconLegend>
            {planeIconSvg(type === 'arrival' ? '#00BCD4' : '#FF9800', 14)}
            <LegendArrow $type={type}>{type === 'arrival' ? '▼' : '▲'}</LegendArrow>
          </IconLegend>
        </TitleRow>
        <HeaderRight>
          {scale !== 1 && <ScaleIndicator>{Math.round(scale * 100)}%</ScaleIndicator>}
          <Count>{sortedFlights.length}{flights.length > 20 ? ` / ${flights.length}` : ''}</Count>
        </HeaderRight>
      </Header>
      <List ref={listRef} $scale={scale}>
        {sortedFlights.length === 0 ? (
          <EmptyState>{type === 'arrival' ? t.noArrivals : t.noDepartures}</EmptyState>
        ) : (
          sortedFlights.map((flight, index) => {
            // 使用 flightNumber 作为标识匹配选中的飞机（通过 callsign 匹配雷达数据）
            const normalizedFlightNumber = normalizeCallsign(flight.flightNumber);
            const isSelected = normalizedFlightNumber && selectedFlight?.callsign
              ? normalizeCallsign(selectedFlight.callsign) === normalizedFlightNumber
              : false;
            const shouldScrollTo = index === scrollToIndex;
            const isNextFlight = index === nextFlightIndex;

            return (
              <ListItem
                key={`${flight.flightNumber}-${index}`}
                ref={shouldScrollTo ? middleItemRef : null}
                selected={isSelected}
                $isNextFlight={isNextFlight}
                $type={type}
                onClick={() => onSelect(flight)}
              >
                <FlightHeader>
                  <FlightInfoWrapper>
                    <Callsign>{(flight.flightNumber || '-').replace(/\s+/g, '')}</Callsign>
                    {(() => {
                      // 显示出发地（到达航班）或目的地（出发航班）+ 国家
                      if (type === 'arrival' && flight.origin) {
                        // 到达航班显示出发地 + 国家
                        const airportName = flight.origin.name || flight.origin.iata || '';
                        const country = getCountryByAirport(flight.origin.iata, lang);
                        const display = country ? `${airportName} ${country}` : airportName;
                        return display ? <Route>（{display}）</Route> : null;
                      }
                      if (type === 'departure' && flight.destination) {
                        // 出发航班显示目的地 + 国家
                        const airportName = flight.destination.name || flight.destination.iata || '';
                        const country = getCountryByAirport(flight.destination.iata, lang);
                        const display = country ? `${airportName} ${country}` : airportName;
                        return display ? <Route>（{display}）</Route> : null;
                      }
                      return null;
                    })()}
                    {getAirline(flight.flightNumber, lang) && (
                      <Airline>{getAirline(flight.flightNumber, lang)}</Airline>
                    )}
                  </FlightInfoWrapper>
                  {/* 显示计划时间和状态 */}
                  {flight.scheduledTime && (
                    <Time $hasSchedule={true}>
                      {flight.scheduledTime}
                      {flight.status && <Status $status={flight.status}>{flight.status}</Status>}
                    </Time>
                  )}
                </FlightHeader>

                {/* 显示登机口信息（不显示航站楼） */}
                {flight.gate && (
                  <Details>
                    <DetailItem>Gate {flight.gate}</DetailItem>
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

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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

const IconLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const LegendArrow = styled.span<{ $type: 'arrival' | 'departure' }>`
  font-size: 10px;
  color: ${props => props.$type === 'arrival' ? '#00BCD4' : '#FF9800'};
  font-weight: bold;
  line-height: 1;
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

const ListItem = styled.div<{ selected: boolean; $isNextFlight?: boolean; $type?: 'arrival' | 'departure' }>`
  padding: 0.625em 0.875em;  /* 10px 14px -> em for scaling */
  cursor: pointer;
  position: relative;
  background: ${(props) => {
    if (props.selected) {
      return 'linear-gradient(90deg, rgba(0, 255, 0, 0.15) 0%, rgba(0, 255, 0, 0.05) 100%)';
    }
    if (props.$isNextFlight) {
      // 最近即将到达/出发的航班 - 特殊高亮背景（加深颜色）
      const color = props.$type === 'arrival' ? '0, 188, 212' : '255, 152, 0'; // cyan / orange
      return `linear-gradient(90deg, rgba(${color}, 0.35) 0%, rgba(${color}, 0.15) 100%)`;
    }
    return 'transparent';
  }};
  border-bottom: 1px solid rgba(0, 255, 255, 0.08);
  border-left: 3px solid ${(props) => {
    if (props.selected) return '#00ff00';
    if (props.$isNextFlight) {
      return props.$type === 'arrival' ? '#00BCD4' : '#FF9800';
    }
    return 'transparent';
  }};
  transition: all 0.2s ease;

  /* 最近即将到达/出发的航班 - 添加脉冲动画边框 */
  ${(props) => props.$isNextFlight && `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: ${props.$type === 'arrival' ? '#00BCD4' : '#FF9800'};
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `}

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

