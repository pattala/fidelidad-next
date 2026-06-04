const fs = require('fs');

// Fix router.tsx
let router = fs.readFileSync('src/router.tsx', 'utf8');
const targetRoute = `            {
                path: "play/:id",
                element: <MysteryBoxPage />
            },`;
const newRoute = `            {
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
    router = router.replace(targetRoute, newRoute);
    fs.writeFileSync('src/router.tsx', router);
    console.log("Patched router.tsx");
} else {
    console.log("router.tsx already patched");
}

// Fix MysteryBoxConfig.tsx QR generation
let config = fs.readFileSync('src/modules/admin/components/MysteryBoxConfig.tsx', 'utf8');
config = config.replace(/{config\.contact\?\.pwaUrl \|\| window\.location\.origin}\/play/g, '{config.contact?.pwaUrl || window.location.origin}/sorteo');
config = config.replace(/\(config\.contact\?\.pwaUrl \|\| window\.location\.origin\) \+ '\/play'/g, "(config.contact?.pwaUrl || window.location.origin) + '/sorteo'");
fs.writeFileSync('src/modules/admin/components/MysteryBoxConfig.tsx', config);
console.log("Patched MysteryBoxConfig.tsx QR code");
