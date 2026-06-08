package com.safeturn.rider

import android.app.Activity
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.Locale

class MainActivity : Activity() {
    private val scope = MainScope()
    private lateinit var api: SafeTurnApi
    private lateinit var content: LinearLayout
    private lateinit var bottomNav: LinearLayout
    private var snapshot = SafeTurnSnapshot()
    private var currentTab = Tab.Home
    private var brightness = 80
    private var realtimeStatus = "正在连接实时数据"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Palette.Background
        window.navigationBarColor = Palette.BottomBar

        api = SafeTurnApi(serverBaseUrl())
        setupShell()
        render()
        loadSnapshot()
        connectRealtime()
    }

    override fun onDestroy() {
        api.close()
        scope.cancel()
        super.onDestroy()
    }

    private fun setupShell() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Palette.Background)
        }

        val scroll = ScrollView(this).apply {
            isFillViewport = false
            overScrollMode = View.OVER_SCROLL_NEVER
        }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(22))
        }
        scroll.addView(content, ViewGroup.LayoutParams(match, wrap))

        bottomNav = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(6), dp(6), dp(6), dp(8))
            setBackgroundColor(Palette.BottomBar)
        }

        root.addView(scroll, LinearLayout.LayoutParams(match, 0, 1f))
        root.addView(bottomNav, LinearLayout.LayoutParams(match, dp(72)))
        setContentView(root)
    }

    private fun loadSnapshot() {
        scope.launch {
            runCatching { api.fetchSnapshot() }
                .onSuccess {
                    snapshot = it
                    render()
                }
                .onFailure {
                    toast("连接 server 失败：${it.message}")
                }
        }
    }

    private fun connectRealtime() {
        api.connectRealtime(
            onSnapshot = {
                runOnUiThread {
                    snapshot = it
                    render()
                }
            },
            onStatus = {
                runOnUiThread {
                    realtimeStatus = it
                    renderBottomNav()
                }
            }
        )
    }

    private fun render() {
        content.removeAllViews()
        when (currentTab) {
            Tab.Home -> renderHome()
            Tab.Navigation -> renderNavigation()
            Tab.Safety -> renderSafety()
            Tab.History -> renderHistory()
            Tab.Mine -> renderMine()
        }
        renderBottomNav()
    }

    private fun renderBottomNav() {
        bottomNav.removeAllViews()
        Tab.entries.forEach { tab ->
            val selected = currentTab == tab
            bottomNav.addView(
                TextView(this).apply {
                    text = "${tab.symbol}\n${tab.title}"
                    gravity = Gravity.CENTER
                    textSize = 12f
                    setTextColor(if (selected) Palette.Blue else Palette.Muted)
                    typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                    setOnClickListener {
                        currentTab = tab
                        render()
                    }
                },
                LinearLayout.LayoutParams(0, match, 1f)
            )
        }
    }

    private fun renderHome() {
        val device = selectedDevice()
        val telemetry = device.telemetry

        header("SafeTurn", "${device.name} · $realtimeStatus", "已连接")

        grid(columns = 3) {
            metric("蓝牙", "已连接", Palette.Blue)
            metric("4G", signalText(telemetry.fourGSignal), Palette.Green)
            metric("GPS", gpsText(telemetry.gpsStatus), Palette.Blue)
            metric("电量", "${telemetry.battery}%", Palette.Green)
            metric("速度", "${telemetry.speedKmh.format1()}", Palette.Text)
            metric("海拔", "${telemetry.altitudeM.format1()}m", Palette.Text)
            metric("温度", "${telemetry.temperatureC.format1()}℃", Palette.Text)
            metric("湿度", "${telemetry.humidityPct}%", Palette.Text)
            metric("环境光", "${telemetry.ambientLightLux}", Palette.Text)
        }

        statusStrip("状态：${helmetStatusText(telemetry.helmetStatus)}", if (telemetry.helmetStatus == "normal") Palette.Green else Palette.Red)

        card {
            title("灯带控制")
            val commands = GridLayout(this@MainActivity).apply {
                columnCount = 4
                useDefaultMargins = false
            }
            listOf(
                "LEFT" to "左转",
                "RIGHT" to "右转",
                "DOUBLE" to "双闪",
                "STOP" to "停止"
            ).forEach { (command, label) ->
                commands.addView(
                    commandButton(label) { sendLightCommand(command) },
                    GridLayout.LayoutParams().apply {
                        width = 0
                        height = dp(72)
                        columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                        setMargins(dp(4), dp(8), dp(4), dp(4))
                    }
                )
            }
            addView(commands, LinearLayout.LayoutParams(match, wrap))

            val brightnessLabel = bodyText("亮度 $brightness%").apply {
                setPadding(0, dp(10), 0, dp(4))
            }
            addView(brightnessLabel)
            addView(
                android.widget.SeekBar(this@MainActivity).apply {
                    max = 100
                    progress = brightness
                    setOnSeekBarChangeListener(object : android.widget.SeekBar.OnSeekBarChangeListener {
                        override fun onProgressChanged(seekBar: android.widget.SeekBar?, progress: Int, fromUser: Boolean) {
                            brightness = progress.coerceAtLeast(10)
                            brightnessLabel.text = "亮度 $brightness%"
                        }

                        override fun onStartTrackingTouch(seekBar: android.widget.SeekBar?) = Unit
                        override fun onStopTrackingTouch(seekBar: android.widget.SeekBar?) {
                            sendLightCommand("STOP")
                        }
                    })
                },
                LinearLayout.LayoutParams(match, wrap)
            )
        }

        addView(SosButton(this@MainActivity) { triggerSos() }, LinearLayout.LayoutParams(match, dp(118)).withTop(dp(14)))
    }

    private fun renderNavigation() {
        val device = selectedDevice()
        card {
            eyebrow("前方 50 米")
            addView(TextView(this@MainActivity).apply {
                text = "左转"
                textSize = 30f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
            })
        }

        addView(NavigationMapView(this), LinearLayout.LayoutParams(match, dp(320)).withTop(dp(14)))

        grid(columns = 3) {
            metric("当前速度", "${device.telemetry.speedKmh.format1()}", Palette.Blue)
            metric("剩余距离", "2.3km", Palette.Text)
            metric("预计到达", "12分", Palette.Text)
        }

        statusStrip("下一步：前方 50 米左转，头盔左侧灯带将提前流水提示", Palette.Amber)
        grid(columns = 2) {
            metric("当前海拔", "${device.telemetry.altitudeM.format1()}m", Palette.Text)
            metric("累计爬升", "12m", Palette.Green)
        }
    }

    private fun renderSafety() {
        val telemetry = selectedDevice().telemetry
        sectionTitle("安全监测")
        card {
            eyebrow("BNO055 九轴姿态传感器")
            body("集成加速度计、陀螺仪、磁力计和姿态融合算法，实时输出 Pitch、Roll、Yaw 与冲击数据。")
        }

        grid(columns = 2) {
            metric("冲击强度", "${telemetry.impactG.format1()}g", if (telemetry.impactG > 2.0) Palette.Amber else Palette.Green)
            metric("温度", "${telemetry.temperatureC.format1()}℃", Palette.Text)
            metric("湿度", "${telemetry.humidityPct}%", Palette.Text)
            metric("环境光", "${telemetry.ambientLightLux}", Palette.Text)
        }

        listCard(
            "BNO055" to "九轴姿态融合正常",
            "Pitch" to "${telemetry.pitch.format1()}°",
            "Roll" to "${telemetry.roll.format1()}°",
            "Yaw" to "${telemetry.yaw.format1()}°",
            "气压" to "${telemetry.pressureHpa.format1()} hPa",
            "卫星数量" to "${telemetry.satelliteCount}",
            "头盔状态" to helmetStatusText(telemetry.helmetStatus)
        )
    }

    private fun renderHistory() {
        val ride = snapshot.rides.firstOrNull() ?: RideSummary()
        sectionTitle("历史轨迹")
        addView(HistoryMapView(this), LinearLayout.LayoutParams(match, dp(260)).withTop(dp(8)))
        grid(columns = 2) {
            metric("骑行距离", "${ride.distanceKm.format1()}km", Palette.Blue)
            metric("平均速度", "${ride.averageSpeedKmh.format1()}", Palette.Text)
            metric("最高速度", "${ride.maxSpeedKmh.format1()}", Palette.Text)
            metric("累计爬升", "${ride.elevationGainM}m", Palette.Green)
        }
        addView(AltitudeChartView(this, ride.points), LinearLayout.LayoutParams(match, dp(220)).withTop(dp(14)))
        val alarms = snapshot.alarms.take(3)
        if (alarms.isNotEmpty()) {
            card {
                title("危险点")
                alarms.forEach { alarm ->
                    row(alarm.typeText(), "${alarm.impactG.format1()}g · ${alarm.statusText()}")
                }
            }
        }
    }

    private fun renderMine() {
        val device = selectedDevice()
        card {
            title(device.name)
            body("SN: ${device.sn}\n固件版本：${device.firmwareVersion}\n蓝牙 MAC：${device.bluetoothMac}\n4G IMEI：${device.imei}")
        }
        listCard(
            "跌倒灵敏度" to "中",
            "自动报警倒计时" to "15秒",
            "夜间自动开灯" to "开启",
            "转向灯提前距离" to "50米",
            "SOS 短信通知" to "开启",
            "报警声音" to "开启",
            "震动提醒" to "开启"
        )
        card {
            title("紧急联系人")
            row("1 张妈妈", "138****1234 · 母亲")
            row("2 李先生", "139****5678 · 父亲")
            row("3 王小明", "137****9012 · 朋友")
        }
        card {
            title("Server 地址")
            val input = EditText(this@MainActivity).apply {
                setText(serverBaseUrl())
                setSingleLine(true)
                textSize = 14f
                setTextColor(Palette.Text)
                setHintTextColor(Palette.Muted)
                setPadding(dp(12), 0, dp(12), 0)
                background = rounded(Palette.CardAlt, dp(8), Palette.Border)
            }
            addView(input, LinearLayout.LayoutParams(match, dp(48)).withTop(dp(8)))
            addView(primaryButton("保存并重连") {
                saveServerBaseUrl(input.text.toString())
                hideKeyboard(input)
                api.updateBaseUrl(serverBaseUrl())
                loadSnapshot()
                connectRealtime()
                toast("Server 地址已更新")
            }, LinearLayout.LayoutParams(match, dp(48)).withTop(dp(10)))
            body("模拟器访问本机服务用 http://10.0.2.2:4000；真机访问同一局域网 Mac 用 http://192.168.5.4:4000。")
        }
    }

    private fun selectedDevice(): Device = snapshot.devices.firstOrNull { it.id == "ST-0001" } ?: snapshot.devices.firstOrNull() ?: Device()

    private fun sendLightCommand(command: String) {
        val deviceId = selectedDevice().id
        scope.launch {
            runCatching { api.sendCommand(deviceId, command, brightness) }
                .onSuccess { toast(it.message) }
                .onFailure { toast("命令发送失败：${it.message}") }
        }
    }

    private fun triggerSos() {
        val deviceId = selectedDevice().id
        vibrate()
        scope.launch {
            runCatching {
                api.sendCommand(deviceId, "SOS")
                api.triggerSos(deviceId)
            }.onSuccess {
                toast(it.message)
                loadSnapshot()
            }.onFailure {
                toast("SOS 触发失败：${it.message}")
            }
        }
    }

    private fun vibrate() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 120, 80, 160), -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(longArrayOf(0, 120, 80, 160), -1)
        }
    }

    private fun serverBaseUrl(): String {
        return getSharedPreferences("safeturn", MODE_PRIVATE)
            .getString("server_base_url", BuildConfig.DEFAULT_SERVER_BASE_URL)
            ?: BuildConfig.DEFAULT_SERVER_BASE_URL
    }

    private fun saveServerBaseUrl(url: String) {
        getSharedPreferences("safeturn", MODE_PRIVATE)
            .edit()
            .putString("server_base_url", url.trim().trimEnd('/'))
            .apply()
    }

    private fun hideKeyboard(view: View) {
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(view.windowToken, 0)
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun header(title: String, subtitle: String, badge: String) = content.header(title, subtitle, badge)
    private fun grid(columns: Int, block: GridLayout.() -> Unit) = content.grid(columns, block)
    private fun statusStrip(text: String, accent: Int) = content.statusStrip(text, accent)
    private fun card(block: LinearLayout.() -> Unit) = content.card(block)
    private fun listCard(vararg rows: Pair<String, String>) = content.listCard(*rows)
    private fun sectionTitle(text: String) = content.sectionTitle(text)
    private fun addView(view: View, params: ViewGroup.LayoutParams) = content.addView(view, params)

    private fun LinearLayout.header(title: String, subtitle: String, badge: String) {
        val row = LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        row.addView(
            LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(this@MainActivity).apply {
                    text = title
                    textSize = 22f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.WHITE)
                })
                addView(TextView(this@MainActivity).apply {
                    text = subtitle
                    textSize = 12f
                    setTextColor(Palette.Muted)
                })
            },
            LinearLayout.LayoutParams(0, wrap, 1f)
        )
        row.addView(TextView(this@MainActivity).apply {
            text = badge
            textSize = 12f
            setTextColor(Palette.Green)
            gravity = Gravity.CENTER
            background = rounded(Palette.GreenSoft, dp(999), Palette.Green)
            setPadding(dp(12), dp(6), dp(12), dp(6))
        })
        addView(row, LinearLayout.LayoutParams(match, wrap).withBottom(dp(12)))
    }

    private fun LinearLayout.grid(columns: Int, block: GridLayout.() -> Unit) {
        val grid = GridLayout(this@MainActivity).apply {
            columnCount = columns
            block()
        }
        addView(grid, LinearLayout.LayoutParams(match, wrap).withTop(dp(6)))
    }

    private fun GridLayout.metric(label: String, value: String, accent: Int) {
        addView(
            LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(12), dp(10), dp(12), dp(10))
                background = rounded(Palette.CardAlt, dp(10), Palette.Border)
                addView(TextView(context).apply {
                    text = label
                    textSize = 12f
                    setTextColor(accent)
                })
                addView(TextView(context).apply {
                    text = value
                    textSize = 22f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.WHITE)
                    setPadding(0, dp(8), 0, 0)
                    maxLines = 1
                })
            },
            GridLayout.LayoutParams().apply {
                width = 0
                height = dp(86)
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                setMargins(dp(4), dp(4), dp(4), dp(4))
            }
        )
    }

    private fun LinearLayout.statusStrip(text: String, accent: Int) {
        addView(
            TextView(this@MainActivity).apply {
                this.text = text
                textSize = 14f
                setTextColor(accent)
                setPadding(dp(14), dp(12), dp(14), dp(12))
                background = rounded(withAlpha(accent, 0.12f), dp(10), withAlpha(accent, 0.24f))
            },
            LinearLayout.LayoutParams(match, wrap).withTop(dp(12))
        )
    }

    private fun LinearLayout.card(block: LinearLayout.() -> Unit) {
        addView(
            LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14), dp(14), dp(14), dp(14))
                background = rounded(Palette.Card, dp(10), Palette.Border)
                block()
            },
            LinearLayout.LayoutParams(match, wrap).withTop(dp(14))
        )
    }

    private fun LinearLayout.listCard(vararg rows: Pair<String, String>) {
        card {
            rows.forEach { (label, value) -> row(label, value) }
        }
    }

    private fun LinearLayout.sectionTitle(text: String) {
        addView(TextView(this@MainActivity).apply {
            this.text = text
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        }, LinearLayout.LayoutParams(match, wrap).withTop(dp(6)))
    }

    private fun LinearLayout.title(text: String) {
        addView(TextView(this@MainActivity).apply {
            this.text = text
            textSize = 17f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        })
    }

    private fun LinearLayout.eyebrow(text: String) {
        addView(TextView(this@MainActivity).apply {
            this.text = text
            textSize = 13f
            setTextColor(Palette.Muted)
        })
    }

    private fun LinearLayout.body(text: String) {
        addView(bodyText(text), LinearLayout.LayoutParams(match, wrap).withTop(dp(8)))
    }

    private fun bodyText(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 14f
            setTextColor(Palette.Body)
            setLineSpacing(dp(2).toFloat(), 1f)
        }
    }

    private fun LinearLayout.row(label: String, value: String) {
        val row = LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(10), 0, dp(10))
        }
        row.addView(TextView(this@MainActivity).apply {
            text = label
            textSize = 14f
            setTextColor(Palette.Body)
        }, LinearLayout.LayoutParams(0, wrap, 1f))
        row.addView(TextView(this@MainActivity).apply {
            text = value
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.END
        })
        addView(row, LinearLayout.LayoutParams(match, wrap))
    }

    private fun commandButton(label: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = label
            textSize = 14f
            setTextColor(Color.WHITE)
            background = rounded(Palette.CardAlt, dp(10), Palette.Border)
            setOnClickListener { onClick() }
            isAllCaps = false
        }
    }

    private fun primaryButton(label: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = label
            textSize = 15f
            setTextColor(Color.WHITE)
            background = rounded(Palette.Blue, dp(10), Palette.Blue)
            setOnClickListener { onClick() }
            isAllCaps = false
        }
    }

    private fun rounded(fill: Int, radius: Int, stroke: Int): GradientDrawable {
        return GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius.toFloat()
            setStroke(dp(1), stroke)
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private enum class Tab(val title: String, val symbol: String) {
    Home("首页", "⌂"),
    Navigation("导航", "↱"),
    Safety("监测", "◎"),
    History("记录", "⌁"),
    Mine("我的", "⚙")
}

private object Palette {
    val Background: Int = Color.rgb(7, 17, 29)
    val BottomBar: Int = Color.rgb(9, 24, 39)
    val Card: Int = Color.rgb(15, 23, 42)
    val CardAlt: Int = Color.rgb(30, 41, 59)
    val Border: Int = Color.rgb(51, 65, 85)
    val Text: Int = Color.rgb(226, 232, 240)
    val Body: Int = Color.rgb(203, 213, 225)
    val Muted: Int = Color.rgb(148, 163, 184)
    val Blue: Int = Color.rgb(59, 130, 246)
    val Green: Int = Color.rgb(52, 211, 153)
    val GreenSoft: Int = Color.rgb(6, 78, 59)
    val Amber: Int = Color.rgb(251, 191, 36)
    val Red: Int = Color.rgb(239, 68, 68)
}

private class SosButton(context: Context, private val onConfirmed: () -> Unit) : FrameLayout(context) {
    private val progress = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal)
    private var downAt = 0L
    private val tick = object : Runnable {
        override fun run() {
            val elapsed = System.currentTimeMillis() - downAt
            progress.progress = ((elapsed / 3000f) * 100).toInt().coerceIn(0, 100)
            if (elapsed >= 3000L) {
                cancel()
                onConfirmed()
            } else {
                postDelayed(this, 60)
            }
        }
    }

    init {
        background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(Palette.Red, Color.rgb(185, 28, 28))).apply {
            cornerRadius = dp(14).toFloat()
        }
        progress.max = 100
        progress.progress = 0
        progress.alpha = 0.35f
        addView(progress, LayoutParams(match, match))
        addView(TextView(context).apply {
            text = "SOS\n长按 3 秒紧急求救"
            gravity = Gravity.CENTER
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        }, LayoutParams(match, match))
        setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downAt = System.currentTimeMillis()
                    progress.progress = 0
                    post(tick)
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    cancel()
                    true
                }

                else -> true
            }
        }
    }

    private fun cancel() {
        removeCallbacks(tick)
        progress.progress = 0
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private open class NavigationMapView(context: Context) : View(context) {
    private val grid = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(34, 148, 163, 184); strokeWidth = 1f }
    private val route = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.Blue; strokeWidth = dp(5).toFloat(); style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
    private val marker = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.Green; style = Paint.Style.FILL }

    init {
        background = roundedBg()
        setPadding(dp(8), dp(8), dp(8), dp(8))
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        drawGrid(canvas)
        val path = Path().apply {
            moveTo(width * 0.18f, height * 0.96f)
            cubicTo(width * 0.18f, height * 0.76f, width * 0.36f, height * 0.76f, width * 0.36f, height * 0.56f)
            lineTo(width * 0.36f, height * 0.36f)
            cubicTo(width * 0.36f, height * 0.22f, width * 0.55f, height * 0.24f, width * 0.72f, height * 0.16f)
        }
        canvas.drawPath(path, route)
        canvas.drawCircle(width * 0.28f, height * 0.72f, dp(16).toFloat(), marker)
    }

    private fun drawGrid(canvas: Canvas) {
        val step = dp(42).toFloat()
        var x = 0f
        while (x < width) {
            canvas.drawLine(x, 0f, x, height.toFloat(), grid)
            x += step
        }
        var y = 0f
        while (y < height) {
            canvas.drawLine(0f, y, width.toFloat(), y, grid)
            y += step
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class HistoryMapView(context: Context) : NavigationMapView(context) {
    private val danger = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.Red; style = Paint.Style.FILL }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawCircle(width * 0.50f, height * 0.48f, dp(13).toFloat(), danger)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private class AltitudeChartView(context: Context, private val points: List<TrackPoint>) : View(context) {
    private val border = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.Border; strokeWidth = dp(1).toFloat(); style = Paint.Style.STROKE }
    private val altitude = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.Blue; strokeWidth = dp(2).toFloat(); style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val speed = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.Amber; strokeWidth = dp(2).toFloat(); style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }

    init {
        background = roundedBg()
        setPadding(dp(14), dp(14), dp(14), dp(14))
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val rect = RectF(dp(14).toFloat(), dp(18).toFloat(), width - dp(14).toFloat(), height - dp(18).toFloat())
        canvas.drawRoundRect(rect, dp(8).toFloat(), dp(8).toFloat(), border)
        drawLine(canvas, rect, points.map { it.altitudeM }, altitude)
        drawLine(canvas, rect, points.map { it.speedKmh }, speed)
    }

    private fun drawLine(canvas: Canvas, rect: RectF, values: List<Double>, paint: Paint) {
        if (values.size < 2) return
        val min = values.minOrNull() ?: 0.0
        val max = values.maxOrNull() ?: 1.0
        val range = (max - min).takeIf { it > 0.1 } ?: 1.0
        val path = Path()
        values.takeLast(32).forEachIndexed { index, value ->
            val x = rect.left + rect.width() * index / (values.takeLast(32).size - 1).coerceAtLeast(1)
            val y = rect.bottom - rect.height() * ((value - min) / range).toFloat()
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        canvas.drawPath(path, paint)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private fun roundedBg(): GradientDrawable {
    return GradientDrawable().apply {
        setColor(Palette.Card)
        cornerRadius = 18f
        setStroke(1, Palette.Border)
    }
}

private fun LinearLayout.LayoutParams.withTop(value: Int): LinearLayout.LayoutParams {
    topMargin = value
    return this
}

private fun LinearLayout.LayoutParams.withBottom(value: Int): LinearLayout.LayoutParams {
    bottomMargin = value
    return this
}

private fun withAlpha(color: Int, alpha: Float): Int {
    return Color.argb((alpha * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))
}

private fun Double.format1(): String = String.format(Locale.US, "%.1f", this)

private fun signalText(value: String): String = when (value) {
    "strong" -> "在线"
    "medium" -> "中"
    "weak" -> "弱"
    else -> "离线"
}

private fun gpsText(value: String): String = when (value) {
    "fixed" -> "已定位"
    "searching" -> "搜索中"
    else -> "丢失"
}

private fun helmetStatusText(value: String): String = when (value) {
    "normal" -> "正常骑行"
    "impact" -> "异常震动"
    "fall_suspected" -> "疑似跌倒"
    "sos" -> "SOS 报警"
    else -> value
}

private fun AlarmRecord.typeText(): String = when (type) {
    "fall" -> "严重跌倒"
    "sos" -> "SOS 求救"
    "impact" -> "异常震动"
    else -> "异常姿态"
}

private fun AlarmRecord.statusText(): String = when (status) {
    "pending" -> "待处理"
    "notified" -> "已通知"
    "resolved" -> "已处理"
    "rider_cancelled" -> "骑手取消"
    else -> status
}

private const val match = ViewGroup.LayoutParams.MATCH_PARENT
private const val wrap = ViewGroup.LayoutParams.WRAP_CONTENT
