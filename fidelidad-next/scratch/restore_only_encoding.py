import subprocess
import os

# Get content from the branch
cmd = ["git", "show", "backup-2026-04-23-estable:fidelidad-next/extension-club-fidelidad/content.js"]
result = subprocess.run(cmd, capture_output=True)
content = result.stdout # This is bytes

# The content is UTF-8. 
try:
    text = content.decode('utf-8')
except UnicodeDecodeError:
    text = content.decode('latin-1')

# WE ARE NOT PATCHING THE INJECTION LOGIC THIS TIME.
# Just fixing the encoding if it looks broken (though from git show it should be fine if we don't pipe it through powershell).

# Write to the local file
file_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Restored original (non-floating) version with correct UTF-8 encoding")
