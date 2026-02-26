# Fukuoka Flight Tracker

---
## ⚠️ 规范执行保障机制（最高优先级）

**问题**：Claude 在复杂任务中容易遗漏全局 CLAUDE.md 的规范要求。

**解决方案**：三阶段强制检查 + 输出确认

### 阶段 A：任务开始时（必做）
```
📋 任务开始检查：
- [ ] 已阅读全局 CLAUDE.md（项目根目录/../CLAUDE.md）
- [ ] 已阅读项目 CLAUDE.md
- [ ] 已识别本次任务涉及的规范条目
- [ ] 输出：本次任务需遵守的规范摘要
```

### 阶段 B：代码完成时（必做）
```
📋 代码完成检查：
- [ ] 功能实现完整
- [ ] 无控制台错误
- [ ] 响应式设计已验证
- [ ] 输出：代码完成状态确认
```

### 阶段 C：任务结束前（必做，防止遗漏部署）
```
📋 任务结束检查：
- [ ] 敏感信息检查（3个Agent）已完成
- [ ] .gitignore 已更新
- [ ] GitHub 已上传
- [ ] Vercel 已部署（前端）
- [ ] Render 已部署（后端，如有）
- [ ] 最终 URL 已告知用户
- [ ] 输出：完整检查报告
```

### 执行规则
1. **每个阶段必须输出对应的检查清单**
2. **未完成的项目用 ❌ 标记并说明原因**
3. **用户可随时说"检查规范"触发完整检查**
4. **Claude 在被打断后恢复工作时，必须重新执行阶段 A**

---

## 项目概述
实时追踪福冈机场（RJFF）100km范围内的航班，交互式地图 + 航班列表。

## 技术栈
- **前端**: React 19 + TypeScript + Vite
- **样式**: styled-components
- **地图**: Leaflet + react-leaflet
- **状态管理**: React Context
- **后端**: Express (代理服务器)
- **API**: OpenSky Network (OAuth2)

## 目录结构
```
src/
├── components/       # React组件
│   ├── DashboardLayout.tsx   # 主布局（响应式）
│   ├── MapContainer.tsx      # Leaflet地图
│   ├── FlightListsContainer.tsx
│   └── FlightList.tsx
├── context/          # 全局状态
│   └── FlightContext.tsx
├── hooks/            # 自定义Hook
│   ├── useOpenSkyApi.ts
│   └── useWindowSize.ts
├── services/         # API服务
│   └── opensky.ts
└── types/            # 类型定义
    └── flight.ts

server/               # Express代理服务器
└── index.js
```

## 常用命令
```bash
npm run dev           # 前端开发服务器 (5173)
npm run dev:server    # 后端代理服务器 (3001)
npm run dev:all       # 同时启动前后端
npm run build         # 生产构建
npm run lint          # ESLint检查
```

## 环境变量
```env
# 前端 (.env)
VITE_OPENSKY_CLIENT_ID=xxx
VITE_OPENSKY_CLIENT_SECRET=xxx

# 后端 (server/.env)
OPENSKY_CLIENT_ID=xxx
OPENSKY_CLIENT_SECRET=xxx
PORT=3001
```

## 核心功能
- 飞机位置: 每45秒刷新
- 航班列表: 每5分钟刷新
- 福冈机场坐标: 33.5859, 130.451
- 覆盖范围: 100km

## 注意事项
- OpenSky API 有速率限制，已实现指数退避重试
- 响应式设计：桌面左右分栏，移动端标签切换
