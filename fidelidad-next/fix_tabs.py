import re

path = r'c:\Users\pablo\.gemini\antigravity\playground\azure-shuttle\fidelidad-next\src\modules\admin\pages\ConfigPage.tsx'

with open(path, 'rb') as f:
    content = f.read().decode('utf-8')

# Fix Rules to Legales transition
# pattern: )} \n { activeTab === 'legales' && (
content = re.sub(r'\)\}\s*\{\s*activeTab === \'legales\' && \(', ")}\n                                    {activeTab === 'legales' && (", content)

# Fix Legales to Branding transition
# pattern: ) } { activeTab === 'branding' && (
content = re.sub(r'\)\s*\}\s*\{\s*activeTab === \'branding\' && \(', ")}\n                                            {activeTab === 'branding' && (", content)

# Fix Branding to Messaging transition
# pattern: )} {activeTab === 'messaging' && (
content = re.sub(r'\)\}\s*\{activeTab === \'messaging\' && \(', ")}\n                                            {activeTab === 'messaging' && (", content)

with open(path, 'wb') as f:
    f.write(content.encode('utf-8'))

print("Completed")
