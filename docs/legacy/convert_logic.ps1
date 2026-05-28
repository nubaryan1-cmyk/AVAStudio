$ffmpeg = "D:\FFMPEG\downloads\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe"
$folders = @("D:\FFMPEG\Source\flash", "D:\FFMPEG\Source\reaction")

Write-Host "=== НАЧИНАЮ КОНВЕРТАЦИЮ (MOV -> MP4) ===" -ForegroundColor Cyan

foreach ($folder in $folders) {
    if (Test-Path $folder) {
        $files = Get-ChildItem -Path $folder -Filter "*.mov"
        
        if ($files.Count -gt 0) {
            Write-Host "Обработка папки: $folder" -ForegroundColor Yellow
            foreach ($file in $files) {
                $input = $file.FullName
                $output = [System.IO.Path]::ChangeExtension($input, ".mp4")
                
                Write-Host "Конвертирую: $($file.Name)..." -NoNewline
                
                # Конвертируем
                $argList = "-y -i `"$input`" -c:v libx264 -crf 20 -preset fast -c:a aac -b:a 192k -movflags +faststart `"$output`""
                $p = Start-Process -FilePath $ffmpeg -ArgumentList $argList -Wait -NoNewWindow -PassThru
                
                if ($p.ExitCode -eq 0) {
                    Write-Host " [OK]" -ForegroundColor Green
                    # УДАЛЯЕМ ИСХОДНИК
                    Remove-Item $input -Force
                } else {
                    Write-Host " [ОШИБКА]" -ForegroundColor Red
                }
            }
        }
    }
}
Write-Host "`nГотово! Окно закроется через 3 секунды..." -ForegroundColor Gray
Start-Sleep -Seconds 3
