$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$python = 'C:\Users\concr\AppData\Local\Programs\Python\Python311\python.exe'
$ffmpeg = 'C:\Users\concr\AppData\Local\Programs\Python\Python311\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
$rifeRoot = Join-Path $projectRoot 'tools\ECCV2022-RIFE'
$inputDir = Join-Path $projectRoot 'tools\rife-input'
$outputDir = Join-Path $projectRoot 'public\whyzip\motion-rife'
$sourceDir = Join-Path $projectRoot 'public\assets\rendering-intro\png'

New-Item -ItemType Directory -Force -Path $inputDir, $outputDir | Out-Null
Get-ChildItem -LiteralPath $inputDir -Filter '*.png' | Remove-Item -Force
Get-ChildItem -LiteralPath $outputDir -Filter '*.png' | Remove-Item -Force

$sourceFrames = Get-ChildItem -LiteralPath $sourceDir -Filter 'frame-*.png' | Sort-Object Name
if ($sourceFrames.Count -ne 34) {
  throw "Expected 34 source frames, found $($sourceFrames.Count)."
}

for ($index = 0; $index -lt $sourceFrames.Count; $index += 1) {
  Copy-Item -LiteralPath $sourceFrames[$index].FullName -Destination (Join-Path $inputDir "$index.png")
}

Push-Location $rifeRoot
try {
  if (Test-Path -LiteralPath 'vid_out') {
    Remove-Item -LiteralPath 'vid_out' -Recurse -Force
  }
  & $python 'inference_video.py' --img $inputDir --exp 3 --scale 0.5
  if ($LASTEXITCODE -ne 0) { throw "RIFE exited with code $LASTEXITCODE." }
  Copy-Item -Path 'vid_out\*.png' -Destination $outputDir -Force
}
finally {
  Pop-Location
}

Push-Location (Join-Path $projectRoot 'motion')
try {
  npm run render:mp4
  if ($LASTEXITCODE -ne 0) { throw "Remotion MP4 render failed with code $LASTEXITCODE." }

  $mp4 = Join-Path $projectRoot 'public\whyzip\intro\intro-dog-rife.mp4'
  $webm = Join-Path $projectRoot 'public\whyzip\intro\intro-dog-rife.webm'
  & $ffmpeg -y -i $mp4 -c:v libvpx-vp9 -crf 30 -b:v 0 -pix_fmt yuv420p -an $webm
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg WebM render failed with code $LASTEXITCODE." }
}
finally {
  Pop-Location
}

# The interpolated PNG sequence is a reproducible render intermediate and is
# intentionally removed so Vite does not copy roughly 500 MB into production.
Get-ChildItem -LiteralPath $outputDir -Filter '*.png' | Remove-Item -Force
