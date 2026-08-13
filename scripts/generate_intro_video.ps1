param(
  [string]$SourceDir = (Join-Path $PSScriptRoot '..\src\assets'),
  [string]$FfmpegDir = (Join-Path $PSScriptRoot '..\.tools\ffmpeg\ffmpeg-9.0.1-essentials_build\bin')
)

$ErrorActionPreference = 'Stop'
$ffmpeg = Join-Path $FfmpegDir 'ffmpeg.exe'
$ffprobe = Join-Path $FfmpegDir 'ffprobe.exe'
$outputDir = Join-Path $PSScriptRoot '..\public\whyzip\intro'

if (-not (Test-Path -LiteralPath $ffmpeg)) {
  throw "ffmpeg.exe not found at $ffmpeg"
}

$frames = 1..9 | ForEach-Object { Join-Path $SourceDir ("intro-frame-{0:00}.png" -f $_) }
foreach ($frame in $frames) {
  if (-not (Test-Path -LiteralPath $frame)) { throw "Missing source frame: $frame" }
  $size = & $ffprobe -v error -show_entries stream=width,height -of csv=p=0 $frame
  if ($size -ne '1672,941') { throw "Unexpected frame size for ${frame}: $size" }
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# Each still is held to the storyboard timestamp. Short 120 ms dissolves avoid
# browser-side PNG swapping while retaining the supplied images as keyframes.
$durations = @(0.51, 0.56, 0.56, 0.46, 0.56, 0.51, 0.56, 0.61, 1.18)
$arguments = @('-y')
for ($index = 0; $index -lt $frames.Count; $index++) {
  $arguments += @('-loop', '1', '-t', $durations[$index].ToString([Globalization.CultureInfo]::InvariantCulture), '-i', $frames[$index])
}

$filters = @()
for ($index = 0; $index -lt $frames.Count; $index++) {
  $filters += "[${index}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=60,setsar=1,format=yuv420p[v$index]"
}

$offset = $durations[0] - 0.12
$previous = 'v0'
for ($index = 1; $index -lt $frames.Count; $index++) {
  $out = if ($index -eq $frames.Count - 1) { 'intro' } else { "x$index" }
  $offsetText = $offset.ToString('0.000', [Globalization.CultureInfo]::InvariantCulture)
  $filters += "[$previous][v$index]xfade=transition=fade:duration=0.12:offset=$offsetText[$out]"
  $previous = $out
  $offset += $durations[$index] - 0.12
}

$filterGraph = $filters -join ';'
$mp4 = Join-Path $outputDir 'intro-dog.mp4'
$webm = Join-Path $outputDir 'intro-dog.webm'

& $ffmpeg @arguments -filter_complex $filterGraph -map '[intro]' -an -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart $mp4
if ($LASTEXITCODE -ne 0) { throw 'MP4 encoding failed' }

& $ffmpeg -y -i $mp4 -an -c:v libvpx-vp9 -crf 30 -b:v 0 -row-mt 1 -pix_fmt yuv420p $webm
if ($LASTEXITCODE -ne 0) { throw 'WebM encoding failed' }

& $ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration -of json $mp4
