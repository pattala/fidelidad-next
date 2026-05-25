const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
const ps1Path = path.join(__dirname, 'rebuild_config.ps1');

const originalLines = fs.readFileSync(filePath, 'utf8').split('\n');

const ps1Content = fs.readFileSync(ps1Path, 'utf8');
const match = ps1Content.match(/\$newMessagingSection = @'\r?\n([\s\S]*?)'\@/);
const newMessagingSection = match[1];
const newLines = newMessagingSection.split('\n').map(line => line.replace(/\r$/, ''));

const waPreviewCode = [
    '',
    '    // WhatsApp Preview State',
    '    const [waPreview, setWaPreview] = useState({',
    '        isOpen: false,',
    '        content: \'\'',
    '    });',
    '',
    '    const openWaPreview = (text: string) => {',
    '        setWaPreview({ isOpen: true, content: text });',
    '    };',
    ''
];

const part1 = originalLines.slice(0, 153); // lines 0-152
const part2 = originalLines.slice(154, 184); // lines 154-183
const part3 = originalLines.slice(184, 2107); // lines 184-2106
const part4 = newLines;
const part5 = originalLines.slice(3089); // lines 3089-end

const combined = [...part1, ...part2, ...waPreviewCode, ...part3, ...part4, ...part5];

fs.writeFileSync(filePath, combined.join('\n'), 'utf8');
console.log('Rebuilt ConfigPage correctly with NodeJS and UTF-8');
