import os

# Paths
v35_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\scratch\v35_content.js'
current_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'

# Read V35 (source of the Smart Bubble)
with open(v35_path, 'r', encoding='utf-8') as f:
    v35_lines = f.readlines()

# Read Current (source of the Advanced Point Panel)
with open(current_path, 'r', encoding='utf-8') as f:
    curr_lines = f.readlines()

# 1. Take V35 logic from line 1 to 233 (Daily check + showGlobalAlert)
v35_base = v35_lines[0:234]

# 2. Take Current logic from line 207 to the end (detectAmount + showFidelidadPanel + support functions)
# We need to make sure we don't duplicate variables like config, detectedAmount, etc.
# Actually, V35 header already has config, detectedAmount, detectedDiscounts.
# Current file has:
# line 4-10: declarations
# line 12-76: old daily check (REPLACE WITH V35)
# line 78-205: old showGlobalAlert (REPLACE WITH V35)
# line 207-end: detectAmount + showFidPanel

current_advanced_logic = curr_lines[206:] # line 207 is index 206

# 3. Combine
final_content = "".join(v35_base) + "\n" + "".join(current_advanced_logic)

# 4. Final Encoding Fix (ensure no Ô£à etc)
# Git show might have already fixed some, but let's be safe.
# Actually, the v35_content.js was saved with Out-File -Encoding UTF8, which might have added BOM or had CP1252 issues if the terminal was wrong.
# Let's fix common patterns just in case.
final_content = final_content.replace('├í', 'á').replace('├│', 'ó').replace('├▒', 'ñ').replace('├⌐', 'é')
final_content = final_content.replace('┬í', '¡').replace('┬┐', '¿').replace('├ù', '×').replace('Ô£à', '✅')
final_content = final_content.replace('ÔÜá´©Å', '⚠️').replace('ÔÅ│', '⏳').replace('ÔÇö', '—')
final_content = final_content.replace('­ƒÄé', '🎂').replace('­ƒô▒', '📱').replace('­ƒÉ¥', '🐾')
final_content = final_content.replace('┬á', ' ').replace('┬', '') # Clean up broken spaces

with open(current_path, 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Unified V35 Smart Bubble + V31 Advanced Panel successfully")
