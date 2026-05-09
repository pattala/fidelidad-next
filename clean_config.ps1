$path = 'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\src\modules\admin\pages\ConfigPage.tsx'
$content = Get-Content $path
# Lines 1 to 743 are indices 0 to 742
# We want to skip 744 to 1459 (indices 743 to 1458)
# Lines 1460 to end are indices 1459 to length-1
$newContent = $content[0..742] + $content[1459..($content.Length-1)]
$newContent | Set-Content $path
