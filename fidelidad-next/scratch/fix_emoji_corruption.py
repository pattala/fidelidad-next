import os

file_path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\extension-club-fidelidad\content.js'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace interpreted emoji bytes with HTML entities or safe characters
# This handles the "f ö ö" type of corruption
replacements = [
    ('­ƒöö', '&#128227;'), # Megaphone
    ('Ô¡É', '&#11088;'),     # Star
    ('­ƒÄé', '&#127874;'), # Birthday 🎂
    ('ÔÅ│', '&#8987;'),     # Expiration ⏳
    ('­ƒÉ¥', '&#128062;'), # Pet 🐾
    ('­ƒÜÇ', '&#128640;'), # Rocket 🚀
    ('Ô£à', '&#9989;'),     # Check ✅
    ('ÔØî', '&#10060;'),    # X ❌
    ('ÔÜá´©Å', '&#9888;'),  # Warning ⚠️
    ('⚙️', '&#9881;'),       # Gear (if literal)
    ('🚀', '&#128640;'),
    ('✅', '&#9989;'),
    ('❌', '&#10060;'),
    ('⚠️', '&#9888;'),
    ('🎂', '&#127874;'),
    ('⏳', '&#8987;'),
    ('📢', '&#128227;'),
    ('🐾', '&#128062;'),
    ('⭐', '&#11088;'),
    ('✨', '&#10024;'),
    ('🎁', '&#127873;'),
    ('📱', '&#128241;'),
]

for old, new in replacements:
    text = text.replace(old, new)

# Also fix remaining acentos if they were corrupted by my previous merge attempt
# (In case they were double-interpreted)
text = text.replace('├í', 'á').replace('├│', 'ó').replace('├▒', 'ñ').replace('├⌐', 'é').replace('├║', 'ú').replace('├í', 'í')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Emoji corruption fixed using HTML entities.")
