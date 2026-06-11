# SafeTurn API 草案

## 实时通道

- 本地 WebSocket: `ws://localhost:4000/ws`
- 生产 WebSocket: `ws://120.55.195.100:4000/ws`
- 服务端会推送 `snapshot`、`telemetry`、`alarm`、`command_ack` 四类消息。

## REST

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| GET | `/api/snapshot` | 后台大屏初始快照 |
| GET | `/api/devices` | 设备列表 |
| GET | `/api/devices/:deviceId` | 设备详情 |
| POST | `/api/devices/:deviceId/telemetry` | 头盔或模拟器写入遥测 |
| POST | `/api/devices/:deviceId/commands` | 下发灯带/SOS 字符串命令 |
| PATCH | `/api/devices/:deviceId/config` | 下发设备配置 |
| GET | `/api/alarms` | 报警列表 |
| GET | `/api/alarms/:alarmId` | 报警详情，家属 H5 可直接使用 |
| POST | `/api/alarms/trigger` | App 或头盔触发报警 |
| POST | `/api/alarms/:alarmId/resolve` | 标记已处理 |
| GET | `/api/rides?deviceId=ST-0001` | 历史骑行轨迹 |

## MQTT Topic

- 上报遥测: `helmet/{device_id}/telemetry`
- 上报警情: `helmet/{device_id}/alarm`
- 上报事件: `helmet/{device_id}/event`
- 云端下发: `helmet/{device_id}/command`
- 设备回执: `helmet/{device_id}/command_ack`

## BLE V1 字符串命令

`LEFT`、`RIGHT`、`DOUBLE`、`STOP`、`SOS`、`CANCEL`、`BAT?`

后续稳定后升级 Hex 帧：`0xAA + CMD + LEN + DATA + SUM + 0x55`。
