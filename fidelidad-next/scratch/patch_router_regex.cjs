const fs = require('fs');

let router = fs.readFileSync('src/router.tsx', 'utf8');

// Use regex to ignore line endings
const regex = /path: "play\/:id",\s*element: <MysteryBoxPage \/>\s*},/;

const replacementStr = `path: "play/:id",
                element: <MysteryBoxPage />
            },
            {
                path: "sorteo",
                element: <MysteryBoxLookupPage />
            },
            {
                path: "play",
                element: <MysteryBoxLookupPage />
            },`;

if (!router.includes('path: "sorteo"')) {
    if (regex.test(router)) {
        router = router.replace(regex, replacementStr);
        fs.writeFileSync('src/router.tsx', router);
        console.log("Patched router.tsx with REGEX successfully");
    } else {
        console.log("Regex did not match!");
    }
} else {
    console.log("Already patched");
}
