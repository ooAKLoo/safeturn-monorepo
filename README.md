# SafeTurn Monorepo

SafeTurn 是智能骑行头盔演示项目，包含骑手端、家属报警 H5、Web 管理后台大屏和 Node.js 实时服务。

## 工作区

- `apps/server`：Express + WebSocket + 可选 MQTT 桥接，提供遥测、报警、设备命令和轨迹接口。
- `apps/admin-dashboard`：React + TailwindCSS + Lucide + Recharts 后台实时大屏。
- `apps/rider-app`：React PWA 形态骑手端，包含首页仪表盘、灯带控制、导航联动、安全监测、历史轨迹、设置和 SOS。
- `apps/android-rider`：原生 Android Kotlin 骑手端，包含首页仪表盘、灯带控制、长按 SOS、导航、安全监测、历史轨迹和设置页。
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

生产环境默认后端地址已切到 ECS 公网 IP：`http://120.55.195.100:4000`。

## 常用命令

```bash
npm run dev:server
npm run dev:admin
npm run dev:rider
npm run dev:family
npm run typecheck
```

## Android 骑手端

本机 Android SDK 路径如果没有写入环境变量，可以临时这样构建：

```bash
ANDROID_HOME=/Users/yangdongju/Library/Android/sdk npm run android:build
```

Debug APK 输出位置：

```bash
apps/android-rider/build/outputs/apk/debug/android-rider-debug.apk
```

安装到已连接的模拟器或真机：

```bash
ANDROID_HOME=/Users/yangdongju/Library/Android/sdk npm run android:install
```

Android 默认连接生产 server：`http://120.55.195.100:4000`。如果需要临时调试本机服务，可以在 App 的“我的 -> Server 地址”里手动改成模拟器地址 `http://10.0.2.2:4000`，或同一局域网内 Mac 的地址，例如 `http://192.168.5.4:4000`。

## ECS 自动部署

GitHub Actions 会在 `main` 或 `master` 分支更新后自动构建并部署到 ECS `120.55.195.100`。部署后同一个 Node server 同时提供 API、WebSocket 和三个前端入口：

- API: `http://120.55.195.100:4000`
- 后台大屏: `http://120.55.195.100:4000/admin/`
- 骑手端 Web: `http://120.55.195.100:4000/rider/`
- 家属 H5: `http://120.55.195.100:4000/family/`

ECS 首次部署前需要满足：

- 已安装 Node.js 20+ 和 npm。
- 安全组已开放 TCP `4000` 和 SSH `22`。
- SSH 用户可以执行 `sudo systemctl`，例如 `root` 或具备免密 sudo 的 `ubuntu` 用户。

GitHub 仓库需要配置 Secrets：

- `ECS_SSH_PRIVATE_KEY`：能登录 ECS 的 SSH 私钥。
- `ECS_SSH_USER`：SSH 用户名，未配置时默认 `root`。
- `ECS_SSH_PORT`：SSH 端口，未配置时默认 `22`。

部署流程定义在 `.github/workflows/deploy-ecs.yml`。它会执行 `npm ci`、`npm run typecheck`、`npm run build`，再打包产物上传到 ECS 的 `/opt/safeturn`，并通过 systemd 服务 `safeturn-server` 启动 `apps/server/dist/index.js`。

当前 Android 导航页还是自绘示意地图，尚未接入真实地图 SDK。接真实导航建议下一步接高德地图 Android SDK，需要高德 Android Key，并绑定包名 `com.safeturn.rider` 和调试/发布 SHA1。

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
