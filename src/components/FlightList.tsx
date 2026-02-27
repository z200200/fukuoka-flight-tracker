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

  // 按计划时间排序（时刻表数据已经包含时间）
  const sortedFlights = useMemo(() => {
    if (!flights || flights.length === 0) return [];
    return [...flights]
      .filter(f => f != null && f.flightNumber)
      // 过滤无效的flightNumber（排除@等特殊字符）
      .filter(f => {
        const fn = f.flightNumber || '';
        return isValidCallsign(fn);
      })
      .sort((a, b) => {
        // 直接使用时刻表的计划时间排序
        const aScheduledMinutes = parseTimeToMinutes(a.scheduledTime);
        const bScheduledMinutes = parseTimeToMinutes(b.scheduledTime);

        // 如果两者都有计划时间，按计划时间升序排序（早的在前）
        if (aScheduledMinutes !== null && bScheduledMinutes !== null) {
          return aScheduledMinutes - bScheduledMinutes;
        }

        // 有计划时间的排在前面
        if (aScheduledMinutes !== null && bScheduledMinutes === null) return -1;
        if (aScheduledMinutes === null && bScheduledMinutes !== null) return 1;

        // 都没有计划时间时，按航班号排序
        return (a.flightNumber || '').localeCompare(b.flightNumber || '');
      }).slice(0, 20); // 只显示最近20个航班
  }, [flights]);

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

  // 找到"最近即将到达/出发"的航班索引（第一个计划时间 >= 当前时间的航班）
  const nextFlightIndex = useMemo(() => {
    const now = new Date();
    // 转换为日本时间的分钟数
    const japanOffset = 9 * 60; // UTC+9
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const currentMinutes = (utcMinutes + japanOffset) % (24 * 60);

    for (let i = 0; i < sortedFlights.length; i++) {
      const flight = sortedFlights[i];
      // 直接使用时刻表的计划时间
      const scheduledMinutes = parseTimeToMinutes(flight.scheduledTime);

      if (scheduledMinutes !== null && scheduledMinutes >= currentMinutes) {
        return i;
      }
    }
    return -1; // 没有找到（所有航班都已过去）
  }, [sortedFlights]);

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
            const isMostRecent = index === mostRecentIndex;
            const isNextFlight = index === nextFlightIndex;

            return (
              <ListItem
                key={`${flight.flightNumber}-${index}`}
                ref={isMostRecent ? middleItemRef : null}
                selected={isSelected}
                $isNextFlight={isNextFlight}
                $type={type}
                onClick={() => onSelect(flight)}
              >
                <FlightHeader>
                  <FlightInfoWrapper>
                    <Callsign>{flight.flightNumber || '-'}</Callsign>
                    {(() => {
                      // 显示出发地（到达航班）或目的地（出发航班）
                      if (type === 'arrival' && flight.origin) {
                        // 到达航班显示出发地
                        const display = flight.origin.name || flight.origin.iata || '';
                        return display ? <Route>（{display}）</Route> : null;
                      }
                      if (type === 'departure' && flight.destination) {
                        // 出发航班显示目的地
                        const display = flight.destination.name || flight.destination.iata || '';
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

                {/* 显示登机口和航站楼信息 */}
                {(flight.gate || flight.terminal) && (
                  <Details>
                    {flight.terminal && <DetailItem>T{flight.terminal}</DetailItem>}
                    {flight.gate && <DetailItem>Gate {flight.gate}</DetailItem>}
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

