package com.safeturn.rider

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class SafeTurnApi(
    private var baseUrl: String
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .build()
    private var webSocket: WebSocket? = null

    fun updateBaseUrl(nextBaseUrl: String) {
        baseUrl = nextBaseUrl.trimEnd('/')
    }

    suspend fun fetchSnapshot(): SafeTurnSnapshot = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/api/snapshot")
            .get()
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("HTTP ${response.code}")
            }
            parseSnapshot(JSONObject(response.body?.string().orEmpty()).getJSONObject("data"))
        }
    }

    suspend fun sendCommand(deviceId: String, command: String, brightness: Int? = null): CommandResult =
        withContext(Dispatchers.IO) {
            val bodyJson = JSONObject()
                .put("command", command)
                .apply {
                    if (brightness != null) put("brightness", brightness)
                }
            val request = Request.Builder()
                .url("${baseUrl.trimEnd('/')}/api/devices/$deviceId/commands")
                .post(bodyJson.toString().toRequestBody("application/json".toMediaType()))
                .build()
            executeCommandRequest(request)
        }

    suspend fun triggerSos(deviceId: String): CommandResult = withContext(Dispatchers.IO) {
        val bodyJson = JSONObject()
            .put("deviceId", deviceId)
            .put("source", "app_sos")
            .put("level", "critical")
            .put("impactG", 5.8)
        val request = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/api/alarms/trigger")
            .post(bodyJson.toString().toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                CommandResult(false, "SOS 上传失败：HTTP ${response.code}")
            } else {
                CommandResult(true, "SOS 已触发，正在通知紧急联系人")
            }
        }
    }

    fun connectRealtime(
        onSnapshot: (SafeTurnSnapshot) -> Unit,
        onStatus: (String) -> Unit
    ) {
        webSocket?.close(1000, "reconnect")
        val wsUrl = baseUrl.trimEnd('/').replaceFirst("http://", "ws://").replaceFirst("https://", "wss://") + "/ws"
        val request = Request.Builder().url(wsUrl).build()
        webSocket = client.newWebSocket(
            request,
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    onStatus("实时连接已建立")
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    runCatching {
                        val message = JSONObject(text)
                        if (message.optString("type") == "snapshot") {
                            onSnapshot(parseSnapshot(message.getJSONObject("payload")))
                        }
                    }.onFailure {
                        onStatus("实时数据解析失败")
                    }
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    onStatus("实时连接断开")
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    onStatus("实时连接关闭")
                }
            }
        )
    }

    fun close() {
        webSocket?.close(1000, "activity destroyed")
        webSocket = null
    }

    private fun executeCommandRequest(request: Request): CommandResult {
        return client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                CommandResult(false, "命令失败：HTTP ${response.code}")
            } else {
                val data = JSONObject(response.body?.string().orEmpty()).getJSONObject("data")
                CommandResult(data.optBoolean("success", true), data.optString("message", "命令已下发"))
            }
        }
    }

    private fun parseSnapshot(json: JSONObject): SafeTurnSnapshot {
        return SafeTurnSnapshot(
            devices = json.optJSONArray("devices").orEmptyList { parseDevice(it) },
            alarms = json.optJSONArray("alarms").orEmptyList { parseAlarm(it) },
            rides = json.optJSONArray("tracks").orEmptyList { parseRide(it) }
        )
    }

    private fun parseDevice(json: JSONObject): Device {
        val telemetry = parseTelemetry(json.optJSONObject("telemetry") ?: JSONObject())
        return Device(
            id = json.optString("id", telemetry.deviceId),
            sn = json.optString("sn", "ST20240524001"),
            name = json.optString("name", "SafeTurn-001"),
            riderName = json.optString("riderName", telemetry.riderName),
            bluetoothMac = json.optString("bluetoothMac", "A4:C1:38:10:90:01"),
            imei = json.optString("imei", "864812060000001"),
            simStatus = json.optString("simStatus", "active"),
            firmwareVersion = json.optString("firmwareVersion", "v1.2.3"),
            battery = json.optInt("battery", telemetry.battery),
            onlineStatus = json.optString("onlineStatus", "online"),
            lastSeenAt = json.optString("lastSeenAt", telemetry.timestamp),
            telemetry = telemetry
        )
    }

    private fun parseTelemetry(json: JSONObject): Telemetry {
        val location = json.optJSONObject("location") ?: JSONObject()
        return Telemetry(
            deviceId = json.optString("deviceId", "ST-0001"),
            riderName = json.optString("riderName", "张三"),
            battery = json.optInt("battery", 78),
            fourGSignal = json.optString("fourGSignal", "strong"),
            gpsStatus = json.optString("gpsStatus", "fixed"),
            location = Coordinates(
                lat = location.optDouble("lat", 26.0821),
                lng = location.optDouble("lng", 119.2965)
            ),
            speedKmh = json.optDouble("speedKmh", 18.5),
            satelliteCount = json.optInt("satelliteCount", 12),
            altitudeM = json.optDouble("altitudeM", 45.2),
            pressureHpa = json.optDouble("pressureHpa", 1008.2),
            temperatureC = json.optDouble("temperatureC", 28.5),
            humidityPct = json.optInt("humidityPct", 60),
            ambientLightLux = json.optInt("ambientLightLux", 120),
            impactG = json.optDouble("impactG", 0.8),
            roll = json.optDouble("roll", 1.2),
            pitch = json.optDouble("pitch", 2.8),
            yaw = json.optDouble("yaw", 120.0),
            helmetStatus = json.optString("helmetStatus", "normal"),
            timestamp = json.optString("timestamp", "")
        )
    }

    private fun parseAlarm(json: JSONObject): AlarmRecord {
        return AlarmRecord(
            id = json.optString("id", ""),
            alarmNo = json.optString("alarmNo", ""),
            riderName = json.optString("riderName", ""),
            type = json.optString("type", "fall"),
            impactG = json.optDouble("impactG", 0.0),
            address = json.optString("address", "未知位置"),
            status = json.optString("status", "pending"),
            occurredAt = json.optString("occurredAt", "")
        )
    }

    private fun parseRide(json: JSONObject): RideSummary {
        return RideSummary(
            distanceKm = json.optDouble("distanceKm", 18.4),
            averageSpeedKmh = json.optDouble("averageSpeedKmh", 17.8),
            maxSpeedKmh = json.optDouble("maxSpeedKmh", 31.2),
            elevationGainM = json.optInt("elevationGainM", 86),
            points = json.optJSONArray("points").orEmptyList {
                TrackPoint(
                    speedKmh = it.optDouble("speedKmh", 0.0),
                    altitudeM = it.optDouble("altitudeM", 0.0),
                    impactG = it.optDouble("impactG", 0.0),
                    eventType = it.optString("eventType").ifBlank { null }
                )
            }
        )
    }

    private inline fun <T> JSONArray?.orEmptyList(parser: (JSONObject) -> T): List<T> {
        if (this == null) return emptyList()
        return List(length()) { index -> parser(getJSONObject(index)) }
    }
}
