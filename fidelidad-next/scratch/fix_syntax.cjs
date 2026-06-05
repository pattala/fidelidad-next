const fs = require('fs');
let router = fs.readFileSync('src/router.tsx', 'utf8');
router = router.replace('{\n        {\n        element: (', '{\n        element: (');
router = router.replace('{\r\n        {\r\n        element: (', '{\r\n        element: (');
fs.writeFileSync('src/router.tsx', router);
console.log("Syntax error fixed");
