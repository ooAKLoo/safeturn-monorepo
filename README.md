# SafeTurn Monorepo

SafeTurn 是智能骑行头盔演示项目，包含骑手端、家属报警 H5、Web 管理后台大屏和 Node.js 实时服务。

## 工作区

- `apps/server`：Express + WebSocket + 可选 MQTT 桥接，提供遥测、报警、设备命令和轨迹接口。
- `apps/admin-dashboard`：React + TailwindCSS + Lucide + Recharts 后台实时大屏。
- `apps/rider-app`：React PWA 形态骑手端，包含首页仪表盘、灯带控制、导航联动、安全监测、历史轨迹、设置和 SOS。
- `apps/family-h5`：家属收到短信链接后打开的报警详情页。
- `packages/shared`：前后端共享 TypeScript 类型、API 路由和 MQTT topic 契约。

## 快速启动

```bash
npm install
npm run build
npm run dev
```

默认端口：

- Server: `http://localhost:4000`
- 后台大屏: `http://localhost:5173`
- 骑手端: `http://localhost:5174`
- 家属 H5: `http://localhost:5175`

## 常用命令

```bash
npm run dev:server
npm run dev:admin
npm run dev:rider
npm run dev:family
npm run typecheck
```

## MQTT

默认不开启 MQTT，仅使用内置模拟遥测流。接入 EMQX 时设置：

```bash
MQTT_URL=mqtt://localhost:1883 npm run dev:server
```

Topic 和 REST 接口见 [docs/api.md](docs/api.md)。

## V1 已落地范围

- 骑手端首页仪表盘、灯带左转/右转/双闪/停止、亮度控制、长按 3 秒 SOS。
- 骑手端导航、安全监测、历史轨迹、设备设置和紧急联系人原型页面。
- 家属 H5 报警详情、轨迹示意、地图跳转、拨号/短信、标记已处理。
- Web 后台实时大屏、设备地图、设备状态卡片、报警记录、曲线和电量分布。
- Server REST + WebSocket + 模拟遥测 + MQTT topic 桥接预留。

## 后续对接点

- App 侧 BLE：V1 字符串协议 `LEFT`、`RIGHT`、`DOUBLE`、`STOP`、`SOS`、`CANCEL`。
- 头盔 4G：使用 `helmet/{device_id}/telemetry` 和 `helmet/{device_id}/alarm` 上报。
- 地图 SDK：当前前端先用内置示意地图，真实部署时替换 `LiveMap` 和骑手端轨迹组件的数据源即可。
