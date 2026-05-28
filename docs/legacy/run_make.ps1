# ============================================================
#  run_make.ps1 – FFMPEG Video Uniquizer
#  Поддержка: Mirroring, Random Zoom, FPS Jitter, Metadata Wiper
#  Загружаешь 1 видео → получаешь N уникальных копий
# ============================================================
param(
    [string]$InputFile  = "",
    [int]   $Count      = 1,
    [string]$OutDir     = "D:\FFMPEG\work\out_test_Finish",
    [string]$JobId      = "",
    [int]   $Mirror     = 1,
    [int]   $Zoom       = 1,
    [int]   $FpsJitter  = 1,
    [int]   $Metadata   = 1,
    [int]   $Crop       = 1,
    [int]   $Color      = 1,
    [string]$FfmpegPath = "D:\FFMPEG\downloads\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe"
)

Set-StrictMode -Off
$ErrorActionPreference = "Continue"

# ── Проверки ──────────────────────────────────────────────────────────────────
if (-not $InputFile) {
    # Фоллбэк: берём последний файл из входной папки (совместимость со старым поведением)
    $flashDir = "D:\FFMPEG\work\in\flash"
    if (Test-Path $flashDir) {
        $latest = Get-ChildItem $flashDir -Include *.mp4,*.mov,*.avi,*.mkv -Recurse |
                  Sort-Object LastWriteTime -Descending |
                  Select-Object -First 1
        if ($latest) { $InputFile = $latest.FullName }
    }
}

if (-not (Test-Path $InputFile)) {
    Write-Error "ОШИБКА: Файл не найден: '$InputFile'"
    exit 1
}

if (-not (Test-Path $FfmpegPath)) {
    Write-Error "ОШИБКА: FFmpeg не найден: '$FfmpegPath'"
    exit 1
}

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$Count = [math]::Max(1, [math]::Min(1000, $Count))

Write-Host "══════════════════════════════════════════════"
Write-Host " FFMPEG Uniquizer"
Write-Host " Исходник : $InputFile"
Write-Host " Количество: $Count"
Write-Host " Выход    : $OutDir"
Write-Host "══════════════════════════════════════════════"

# ── Получить длительность видео ───────────────────────────────────────────────
function Get-Duration {
    param([string]$File)
    $probe = "D:\FFMPEG\downloads\ffmpeg-8.0.1-essentials_build\bin\ffprobe.exe"
    if (-not (Test-Path $probe)) { return 30 }
    $out = & $probe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$File" 2>&1
    $dur = [double]0
    if ([double]::TryParse($out, [ref]$dur)) { return $dur }
    return 30
}

$duration = Get-Duration -File $InputFile

# ── Пулы метаданных для уникализации ─────────────────────────────────────────
$DeviceModels = @(
    "iPhone 12",  "iPhone 12 Pro", "iPhone 13",    "iPhone 13 Pro",
    "iPhone 14",  "iPhone 14 Plus","iPhone 14 Pro", "iPhone 15",
    "iPhone 15 Pro","iPhone 15 Pro Max","Samsung Galaxy S23","Samsung Galaxy S24",
    "Google Pixel 7","Google Pixel 8","OnePlus 12"
)
$Manufacturers = @("Apple","Apple","Apple","Apple","Samsung","Samsung","Google","OnePlus")
$SoftwareVersions = @("17.1","17.2","17.3","17.4","17.5","16.7","15.8","14.8")
$Timezones  = @("UTC+3","UTC+0","UTC+1","UTC+2","UTC-5","UTC+8","UTC+9","UTC-3","UTC+5:30")
$Resolutions= @("4032x3024","3264x2448","4032x2268","4000x3000","3840x2160","3840x2880")

# ── Получить частоту кадров исходника ─────────────────────────────────────────
function Get-FPS {
    param([string]$File)
    $probe = "D:\FFMPEG\downloads\ffmpeg-8.0.1-essentials_build\bin\ffprobe.exe"
    if (-not (Test-Path $probe)) { return 30.0 }
    $out = & $probe -v error -select_streams v:0 -show_entries stream=r_frame_rate `
                    -of default=noprint_wrappers=1:nokey=1 "$File" 2>&1
    if ($out -match "(\d+)/(\d+)") {
        $num = [int]$Matches[1]; $den = [int]$Matches[2]
        if ($den -gt 0) { return [math]::Round($num / $den, 3) }
    }
    return 30.0
}
$baseFps = Get-FPS -File $InputFile

# ── Уникализирующий суффикс для имени файла ──────────────────────────────────
function New-UniqName {
    return [System.Guid]::NewGuid().ToString("N").Substring(0, 8)
}

# ══════════════════════════════════════════════════════════════════════════════
#  ГЛАВНЫЙ ЦИКЛ
# ══════════════════════════════════════════════════════════════════════════════
$success = 0
$fail    = 0

for ($i = 1; $i -le $Count; $i++) {

    Write-Host "`n[${i}/${Count}] Обработка..."

    # ── 1. Mirroring (горизонтальное отражение) ───────────────────────────────
    $mirrorFilter = ""
    if ($Mirror -eq 1) {
        $doMirror = (Get-Random -Minimum 0 -Maximum 2) -eq 0   # 50% шанс
        if ($doMirror) { $mirrorFilter = "hflip," }
    }

    # ── 2. Random Zoom 1-5% ────────────────────────────────────────────────────
    $zoomFilter = ""
    if ($Zoom -eq 1) {
        $zoomPct   = (Get-Random -Minimum 1 -Maximum 6) / 100.0      # 0.01 – 0.05
        $scaleFactor = 1.0 + $zoomPct
        # scale увеличиваем, потом кропаем назад до оригинала → нет чёрных полей
        $zoomFilter = "scale=iw*${scaleFactor}:ih*${scaleFactor}:flags=lanczos,crop=iw/${scaleFactor}:ih/${scaleFactor},"
    }

    # ── 3. Color Adjust (небольшой сдвиг оттенка/яркости) ────────────────────
    $colorFilter = ""
    if ($Color -eq 1) {
        $brightness = (Get-Random -Minimum -3 -Maximum 4) / 100.0    # -0.03..+0.03
        $contrast   = 1.0 + (Get-Random -Minimum -2 -Maximum 3) / 100.0
        $saturation = 1.0 + (Get-Random -Minimum -5 -Maximum 6) / 100.0
        $colorFilter = "eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation},"
    }

    # ── 4. Crop (обрезка краёв 1-3%) ─────────────────────────────────────────
    $cropFilter = ""
    if ($Crop -eq 1) {
        $cropPct  = (Get-Random -Minimum 1 -Maximum 4) / 100.0
        $cropW    = "iw*(1-${cropPct}*2)"
        $cropH    = "ih*(1-${cropPct}*2)"
        $cropX    = "iw*${cropPct}"
        $cropY    = "ih*${cropPct}"
        $cropFilter = "crop=${cropW}:${cropH}:${cropX}:${cropY}:exact=1,"
    }

    # Собираем video filter (убираем последнюю запятую)
    $vf = ($mirrorFilter + $zoomFilter + $colorFilter + $cropFilter).TrimEnd(',')

    # ── 5. Frame Rate Jitter ───────────────────────────────────────────────────
    $targetFps = $baseFps
    if ($FpsJitter -eq 1) {
        $jitters = @(-0.03, -0.01, 0.0, 0.01, 0.03)
        $jitter  = $jitters[(Get-Random -Minimum 0 -Maximum $jitters.Count)]
        $targetFps = [math]::Round($baseFps + $jitter, 3)
        if ($targetFps -le 0) { $targetFps = $baseFps }
    }

    # ── 6. Metadata Wiper + Random Device ────────────────────────────────────
    $metaArgs = ""
    if ($Metadata -eq 1) {
        $devIdx   = Get-Random -Minimum 0 -Maximum $DeviceModels.Count
        $mfgIdx   = [math]::Min($devIdx, $Manufacturers.Count - 1)
        $device   = $DeviceModels[$devIdx]
        $mfg      = $Manufacturers[$mfgIdx]
        $software = $SoftwareVersions[(Get-Random -Minimum 0 -Maximum $SoftwareVersions.Count)]
        $tz       = $Timezones[(Get-Random -Minimum 0 -Maximum $Timezones.Count)]
        # Случайная дата создания (последние 180 дней)
        $daysAgo  = Get-Random -Minimum 1 -Maximum 180
        $fakeDate = (Get-Date).AddDays(-$daysAgo).ToString("yyyy-MM-ddTHH:mm:ss")

        $metaArgs = "-map_metadata -1 " +
                    "-metadata device_manufacturer=`"$mfg`" " +
                    "-metadata device_model=`"$device`" " +
                    "-metadata software=`"iOS $software`" " +
                    "-metadata creation_time=`"$fakeDate`" " +
                    "-metadata location=`"$tz`" "
    }

    # ── Имя выходного файла ────────────────────────────────────────────────────
    $uniq      = New-UniqName
    $ext       = [System.IO.Path]::GetExtension($InputFile)
    $outFile   = Join-Path $OutDir "video_${i}_${uniq}${ext}"

    # ── Строим FFmpeg-команду ─────────────────────────────────────────────────
    $cmd = "`"$FfmpegPath`" -y -i `"$InputFile`""

    if ($vf) {
        $cmd += " -vf `"$vf`""
    }

    $cmd += " -r $targetFps"
    $cmd += " $metaArgs"
    $cmd += " -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k"
    $cmd += " `"$outFile`""

    Write-Host "  CMD: $cmd" -ForegroundColor DarkGray

    # ── Запуск ────────────────────────────────────────────────────────────────
    try {
        $proc = Start-Process -FilePath "cmd.exe" `
                              -ArgumentList "/c $cmd 2>&1" `
                              -Wait -PassThru -WindowStyle Hidden

        if ($proc.ExitCode -eq 0 -and (Test-Path $outFile)) {
            $size = [math]::Round((Get-Item $outFile).Length / 1MB, 1)
            Write-Host "  ✅ $outFile ($size MB)" -ForegroundColor Green
            $success++
        } else {
            Write-Host "  ❌ FFmpeg вернул код $($proc.ExitCode)" -ForegroundColor Red
            $fail++
        }
    } catch {
        Write-Host "  ❌ Ошибка: $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }

    # Прогресс (пишем для сервера)
    if ($JobId) {
        $progressFile = "D:\FFMPEG\work\temp_edit\${JobId}_progress.json"
        $progressData = @{ jobId=$JobId; done=$i; total=$Count; success=$success; fail=$fail } | ConvertTo-Json
        Set-Content -Path $progressFile -Value $progressData -Encoding UTF8 -ErrorAction SilentlyContinue
    }
}

# ── Итог ─────────────────────────────────────────────────────────────────────
Write-Host "`n══════════════════════════════════════════════"
Write-Host " ГОТОВО: $success успешно / $fail ошибок / $Count всего"
Write-Host " Результат: $OutDir"
Write-Host "══════════════════════════════════════════════"

if ($fail -gt 0) { exit 2 }
exit 0
