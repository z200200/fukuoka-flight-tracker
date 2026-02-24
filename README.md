# Fukuoka Flight Tracker

实时追踪福冈机场（RJFF）周边航班的Web应用。显示起飞降落前后2小时的航班信息，包括地图可视化、实时位置追踪和详细航班数据。

## 功能特性

- ✈️ **实时航班追踪** - 显示福冈机场100km范围内的所有飞机
- 🗺️ **交互式地图** - 基于Leaflet.js的OpenStreetMap地图
- 📊 **航班列表** - 分别显示到达和出发航班
- 🔄 **自动更新** - 每30秒自动刷新飞机位置
- 📱 **响应式设计** - 支持桌面和移动设备
- 🆓 **完全免费** - 使用OpenSky Network免费API

## 技术栈

- **前端框架**: React 18 + TypeScript
- **地图库**: Leaflet.js + react-leaflet
- **数据源**: OpenSky Network API
- **样式**: styled-components
- **构建工具**: Vite

## 快速开始

### 前置要求

- Node.js 16+
- npm 或 yarn
- OpenSky Network API凭证

### 安装步骤

1. **克隆项目**
   ```bash
   cd fukuoka-flight-tracker
   npm install
   ```

2. **配置API凭证**

   创建 `.env` 文件：
   ```bash
   cp .env.example .env
   ```

   编辑 `.env` 文件，添加你的OpenSky Network凭证：
   ```env
   VITE_OPENSKY_CLIENT_ID=your_client_id_here
   VITE_OPENSKY_CLIENT_SECRET=your_client_secret_here
   ```

   **获取API凭证：**
   - 访问 [OpenSky Network](https://opensky-network.org/)
   - 注册账号
   - 创建OAuth2应用获取Client ID和Secret

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

   应用将在 `http://localhost:5173` 运行

4. **构建生产版本**
   ```bash
   npm run build
   ```

## 许可证

MIT License

---

**注意**: 本项目仅用于学习和演示目的。请遵守OpenSky Network的使用条款和API限制。
