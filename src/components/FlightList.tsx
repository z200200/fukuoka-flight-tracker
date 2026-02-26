import { useRef, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import type { FlightInfo, Flight } from '../types/flight';
import type { RouteInfo } from '../context/FlightContext';
import { useLanguage } from '../context/LanguageContext';

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
  const middleItemRef = useRef<HTMLDivElement>(null);
  const { t, lang } = useLanguage();

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
    <Container>
      <Header>
        <Title>{title}</Title>
        <Count>{sortedFlights.length}{flights.length > 10 ? ` / ${flights.length}` : ''}</Count>
      </Header>
      <List ref={listRef}>
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

                      // 优先使用 OpenSky 的航线数据
                      if (isFlightInfo(flight)) {
                        if (type === 'arrival' && flight.estDepartureAirport && !isCurrentAirport(flight.estDepartureAirport)) {
                          const airport = getAirportName(flight.estDepartureAirport);
                          return <Route>（{airport}）</Route>;
                        }
                        if (type === 'departure' && flight.estArrivalAirport && !isCurrentAirport(flight.estArrivalAirport)) {
                          const airport = getAirportName(flight.estArrivalAirport);
                          return <Route>（{lang === 'ja' ? `${airport}${t.to}` : airport}）</Route>;
                        }
                      }
                      // 使用 HexDB.io 的航线数据
                      const callsign = flight.callsign?.trim();
                      const route = callsign ? flightRoutes?.get(callsign) : null;
                      if (route) {
                        if (type === 'arrival' && route.origin && !isCurrentAirport(route.origin)) {
                          const airport = getAirportName(route.origin);
                          return <Route>（{airport}）</Route>;
                        }
                        if (type === 'departure' && route.destination && !isCurrentAirport(route.destination)) {
                          const airport = getAirportName(route.destination);
                          return <Route>（{lang === 'ja' ? `${airport}${t.to}` : airport}）</Route>;
                        }
                      }
                      return null;
                    })()}
                    {getAirline(flight.callsign, lang) && (
                      <Airline>{getAirline(flight.callsign, lang)}</Airline>
                    )}
                  </FlightInfoWrapper>
                  {isFlightInfo(flight) && (
                    <Time>
                      {type === 'arrival'
                        ? formatTime(flight.lastSeen)
                        : formatTime(flight.firstSeen)}
                    </Time>
                  )}
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

const List = styled.div`
  flex: 1;
  overflow-y: auto;
  background: transparent;

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
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const ListItem = styled.div<{ selected: boolean }>`
  padding: 10px 14px;
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
  gap: 8px;
`;

const FlightInfoWrapper = styled.div`
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Callsign = styled.span`
  font-weight: 700;
  font-size: 14px;
  color: #ffffff;
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 1px;
`;

const Time = styled.div`
  font-size: 12px;
  color: #00ffff;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  text-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
`;

const Route = styled.span`
  font-size: 12px;
  color: rgba(0, 255, 255, 0.6);
`;

const Airline = styled.span`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
`;

const Details = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 4px;
`;

const DetailItem = styled.div`
  font-size: 11px;
  color: rgba(0, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Consolas', 'Monaco', monospace;

  &::before {
    content: '';
    width: 3px;
    height: 3px;
    background: #00ffff;
    border-radius: 50%;
    box-shadow: 0 0 4px #00ffff;
  }
`;

