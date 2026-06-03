const fs = require('fs');

const contentFile = 'extension-club-fidelidad/content.js';
let contentJS = fs.readFileSync(contentFile, 'utf8');

// The string to replace:
const targetString = `        container.innerHTML = '';
        const ui = document.createElement('div');
        ui.style.pointerEvents = 'auto';`;

const replacementString = `        let ui = container.querySelector('div.cf-v35-glass') || container.querySelector('div.cf-v35-bubble');
        if (!ui) {
            ui = document.createElement('div');
            container.innerHTML = '';
            container.appendChild(ui);
        }
        ui.style.pointerEvents = 'auto';`;

contentJS = contentJS.replace(targetString, replacementString);

// Also we must remove `container.appendChild(ui);` at the end of the `render` function 
// so it doesn't append it again if we already appended it or if it already exists.
const targetAppend = `        }
        container.appendChild(ui);
    };`;

const replacementAppend = `        }
    };`;

contentJS = contentJS.replace(targetAppend, replacementAppend);

fs.writeFileSync(contentFile, contentJS);
console.log("Flicker fixed");
