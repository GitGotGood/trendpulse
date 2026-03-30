Add-Type -AssemblyName System.Drawing
$source = "extension/icons/xyz3003_icon_for_a_trending_now_app_white_background_--v_7_8d875f39-b5a6-4760-932f-d4377a8c9098_3.png"
$sizes = @(16, 32, 48, 128)

foreach ($size in $sizes) {
    $dest = "extension/icons/icon$size.png"
    $bmp = [System.Drawing.Image]::FromFile($source)
    $newBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($newBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bmp, 0, 0, $size, $size)
    $newBmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $newBmp.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $dest"
}
