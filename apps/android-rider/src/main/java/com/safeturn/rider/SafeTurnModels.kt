package com.safeturn.rider

data class Coordinates(
    val lat: Double = 26.0821,
    val lng: Double = 119.2965
)

data class Telemetry(
    val deviceId: String = "ST-0001",
    val riderName: String = "张三",
    val battery: Int = 78,
    val fourGSignal: String = "strong",
    val gpsStatus: String = "fixed",
    val location: Coordinates = Coordinates(),
    val speedKmh: Double = 18.5,
    val satelliteCount: Int = 12,
    val altitudeM: Double = 45.2,
    val pressureHpa: Double = 1008.2,
    val temperatureC: Double = 28.5,
    val humidityPct: Int = 60,
    val ambientLightLux: Int = 120,
    val impactG: Double = 0.8,
    val roll: Double = 1.2,
    val pitch: Double = 2.8,
    val yaw: Double = 120.0,
    val helmetStatus: String = "normal",
    val timestamp: String = ""
)

data class Device(
    val id: String = "ST-0001",
    val sn: String = "ST20240524001",
    val name: String = "SafeTurn-001",
    val riderName: String = "张三",
    val bluetoothMac: String = "A4:C1:38:10:90:01",
    val imei: String = "864812060000001",
    val simStatus: String = "active",
    val firmwareVersion: String = "v1.2.3",
    val battery: Int = 78,
    val onlineStatus: String = "online",
    val lastSeenAt: String = "",
    val telemetry: Telemetry = Telemetry()
)

data class AlarmRecord(
    val id: String,
    val alarmNo: String,
    val riderName: String,
    val type: String,
    val impactG: Double,
    val address: String,
    val status: String,
    val occurredAt: String
)

data class TrackPoint(
    val speedKmh: Double,
    val altitudeM: Double,
    val impactG: Double,
    val eventType: String?
)

data class RideSummary(
    val distanceKm: Double = 18.4,
    val averageSpeedKmh: Double = 17.8,
    val maxSpeedKmh: Double = 31.2,
    val elevationGainM: Int = 86,
    val points: List<TrackPoint> = emptyList()
)

data class SafeTurnSnapshot(
    val devices: List<Device> = listOf(Device()),
    val alarms: List<AlarmRecord> = emptyList(),
    val rides: List<RideSummary> = listOf(RideSummary())
)

data class CommandResult(
    val success: Boolean,
    val message: String
)
