const fs = require('fs');

let router = fs.readFileSync('src/router.tsx', 'utf8');

const targetStr = `            {
                path: "play/:id",
                element: <MysteryBoxPage />
            },`;

const replacementStr = `            {
                path: "play/:id",
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
    router = router.replace(targetStr, replacementStr);
    fs.writeFileSync('src/router.tsx', router);
    console.log("Patched router.tsx successfully");
} else {
    console.log("Already patched");
}
