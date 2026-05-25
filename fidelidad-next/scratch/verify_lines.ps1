$filePath = "src\modules\admin\pages\ConfigPage.tsx"
$lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)

Write-Host "Total lines: $($lines.Length)"

# Verify key line content before editing
Write-Host "Line 153 (0-indexed): $($lines[153])"  # activeMsgTab state
Write-Host "Line 177 (0-indexed): $($lines[177])"  # previewModal start
Write-Host "Line 183 (0-indexed): $($lines[183])"  # previewModal end (blank after closing })
Write-Host "Line 2107 (0-indexed): $($lines[2107])"  # SUB-TABS start
Write-Host "Line 3087 (0-indexed): $($lines[3087])"  # messaging section last line before }
Write-Host "Line 3088 (0-indexed): $($lines[3088])"  # messaging close )
Write-Host "Line 3089 (0-indexed): $($lines[3089])"  # messaging close }
Write-Host "Line 3090 (0-indexed): $($lines[3090])"  # blank
Write-Host "Line 3091 (0-indexed): $($lines[3091])"  # { activeTab === 'advanced'...
