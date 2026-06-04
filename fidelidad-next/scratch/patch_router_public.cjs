const fs = require('fs');

let router = fs.readFileSync('src/router.tsx', 'utf8');

// Regex to remove the block from children
const removeRegex = /\s*\{\s*path: "play\/:id",\s*element: <MysteryBoxPage \/>\s*},\s*\{\s*path: "sorteo",\s*element: <MysteryBoxLookupPage \/>\s*},\s*\{\s*path: "play",\s*element: <MysteryBoxLookupPage \/>\s*},/;

if (removeRegex.test(router)) {
    router = router.replace(removeRegex, '');

    const injectRegex = /element: \(\s*<ClientAuthProvider>\s*<ClientAuthGuard>\s*<ClientLayout \/>\s*<\/ClientAuthGuard>\s*<\/ClientAuthProvider>\s*\),\s*children: \[/;
    
    const newBlock = `{
        element: (
            <ClientAuthProvider>
                <ClientLayout />
            </ClientAuthProvider>
        ),
        children: [
            {
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
            }
        ]
    },
    {
        element: (
            <ClientAuthProvider>
                <ClientAuthGuard>
                    <ClientLayout />
                </ClientAuthGuard>
            </ClientAuthProvider>
        ),
        children: [`;
        
    router = router.replace(injectRegex, newBlock);
    
    fs.writeFileSync('src/router.tsx', router);
    console.log("Patched router.tsx to remove AuthGuard from MysteryBox routes");
} else {
    console.log("Could not find the block to remove in router.tsx");
}
