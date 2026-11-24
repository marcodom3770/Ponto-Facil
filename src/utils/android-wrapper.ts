import zlib from 'node:zlib';

export interface ZipEntryInput {
  name: string;
  content: string | Buffer;
}

/**
 * Pure TypeScript PKZIP archive generator (CRC-32 + Deflate/Store)
 * with zero external dependencies for bundling the Android Native Wrapper project.
 */
export function buildZipArchive(entries: ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8');
    const compressed = zlib.deflateRawSync(rawBuf);
    const useDeflate = compressed.length < rawBuf.length;
    const dataBuf = useDeflate ? compressed : rawBuf;
    const method = useDeflate ? 8 : 0;
    const crc = zlib.crc32(rawBuf) >>> 0;

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0x5421, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len

    localParts.push(localHeader, nameBuf, dataBuf);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x5421, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const endOfCentral = Buffer.alloc(22);
  endOfCentral.writeUInt32LE(0x06054b50, 0);
  endOfCentral.writeUInt16LE(0, 4);
  endOfCentral.writeUInt16LE(0, 6);
  endOfCentral.writeUInt16LE(entries.length, 8);
  endOfCentral.writeUInt16LE(entries.length, 10);
  endOfCentral.writeUInt32LE(centralDir.length, 12);
  endOfCentral.writeUInt32LE(offset, 16);
  endOfCentral.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, endOfCentral]);
}

/**
 * Generates a ready-to-compile Android Studio (Kotlin + WebView + SYSTEM_ALERT_WINDOW + AlarmManager)
 * native wrapper project configured for the provided PontoFácil web URL.
 */
export function buildAndroidNativeWrapperZip(appUrl: string): Buffer {
  const safeUrl = (appUrl || 'https://pontofacil.local').replace(/"/g, '');

  const settingsGradle = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "PontoFacilAndroid"
include(":app")
`;

  const rootBuildGradle = `plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.20" apply false
}
`;

  const appBuildGradle = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.pontofacil.pernambucanas"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.pontofacil.pernambucanas"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "3.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
`;

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:label="PontoFácil Pernambucanas"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.DayNight.NoActionBar"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:showWhenLocked="true"
            android:turnScreenOn="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <receiver
            android:name=".LunchAlarmReceiver"
            android:exported="false" />
    </application>
</manifest>
`;

  const mainActivityKt = `package com.pontofacil.pernambucanas

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val appBaseUrl = "${safeUrl}"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        ensureNotificationChannel()

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
        }
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(PontoFacilBridge(this), "PontoFacilAndroid")

        val launchTarget = if (intent?.getBooleanExtra("from_lunch_alarm", false) == true) {
            "$appBaseUrl/?action=bater_ponto"
        } else {
            appBaseUrl
        }
        webView.loadUrl(launchTarget)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra("from_lunch_alarm", false)) {
            webView.loadUrl("$appBaseUrl/?action=bater_ponto")
        }
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "pontofacil_lunch_alarm",
                "Alarme de Retorno do Almoço",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Abre o PontoFácil automaticamente sobre outros apps quando o almoço terminar."
                enableVibration(true)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    inner class PontoFacilBridge(private val ctx: Context) {
        @JavascriptInterface
        fun isNativeWrapper(): Boolean = true

        @JavascriptInterface
        fun hasOverlayPermission(): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(ctx)
            } else true
        }

        @JavascriptInterface
        fun requestOverlayPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(intent)
            }
        }

        @JavascriptInterface
        fun scheduleLunchAlarm(targetEpochMs: Long, expectedEndStr: String) {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(ctx, LunchAlarmReceiver::class.java).apply {
                putExtra("expectedEndStr", expectedEndStr)
            }
            val pending = PendingIntent.getBroadcast(
                ctx,
                1001,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, targetEpochMs, pending)
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, targetEpochMs, pending)
            }
        }

        @JavascriptInterface
        fun cancelLunchAlarm() {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(ctx, LunchAlarmReceiver::class.java)
            val pending = PendingIntent.getBroadcast(
                ctx,
                1001,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            am.cancel(pending)
        }
    }
}
`;

  const receiverKt = `package com.pontofacil.pernambucanas

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class LunchAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "PontoFacil::LunchWakeLock"
        )
        wakeLock.acquire(15_000L)

        val expectedEndStr = intent.getStringExtra("expectedEndStr") ?: ""
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            putExtra("from_lunch_alarm", true)
        }

        // With SYSTEM_ALERT_WINDOW ("Exibir sobre outros apps"), Android allows bringing
        // the WebView Activity directly to the foreground over any open app.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)) {
            context.startActivity(openIntent)
        }

        val fullScreenPending = PendingIntent.getActivity(
            context,
            2001,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, "pontofacil_lunch_alarm")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ Fim do Almoço ($expectedEndStr)")
            .setContentText("Abrindo PontoFácil para registrar seu retorno agora.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setFullScreenIntent(fullScreenPending, true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(2001, notification)
        } catch (_: SecurityException) {}
    }
}
`;

  const readmeTxt = `PontoFácil Pernambucanas — Projeto Android Nativo (WebView + Sobreposição de Apps)
================================================================================

URL configurada automaticamente: ${safeUrl}

O que este app nativo faz:
1. Carrega exatamente o seu PontoFácil Web (${safeUrl}) em tela cheia, mantendo 100% da automação web no Portal Nossa Gente.
2. Expõe a ponte JavaScript window.PontoFacilAndroid para agendar alarmes exatos no sistema Android (AlarmManager.setExactAndAllowWhileIdle).
3. Ao conceder "Exibir sobre outros apps" (SYSTEM_ALERT_WINDOW), quando der o horário exato de volta do almoço, o LunchAlarmReceiver acorda o celular e abre o PontoFácil automaticamente por cima de qualquer outro app.

Como gerar o APK no Android Studio:
1. Extraia este arquivo .zip.
2. Abra a pasta no Android Studio (File > Open).
3. Aguarde o Gradle sincronizar e clique em Build > Build Bundle(s) / APK(s) > Build APK(s).
4. Instale o app-debug.apk no celular e ative "Exibir sobre outros apps" nas configurações do app.
`;

  return buildZipArchive([
    { name: 'PontoFacilAndroid/settings.gradle.kts', content: settingsGradle },
    { name: 'PontoFacilAndroid/build.gradle.kts', content: rootBuildGradle },
    { name: 'PontoFacilAndroid/app/build.gradle.kts', content: appBuildGradle },
    { name: 'PontoFacilAndroid/app/src/main/AndroidManifest.xml', content: manifestXml },
    {
      name: 'PontoFacilAndroid/app/src/main/java/com/pontofacil/pernambucanas/MainActivity.kt',
      content: mainActivityKt,
    },
    {
      name: 'PontoFacilAndroid/app/src/main/java/com/pontofacil/pernambucanas/LunchAlarmReceiver.kt',
      content: receiverKt,
    },
    { name: 'PontoFacilAndroid/README-ANDROID.txt', content: readmeTxt },
  ]);
}
