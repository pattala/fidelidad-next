const fs = require("fs");

// 1. Patch engine-campaigns.js to handle missing SMTP credentials
let engine = fs.readFileSync("api/engine-campaigns.js", "utf8");
engine = engine.replace(
    /if \(emails\.length > 0 && config\.messaging\?\.emailEnabled !== false\) \{/g,
    `if (emails.length > 0 && config.messaging?.emailEnabled !== false && process.env.SMTP_USER && process.env.SMTP_PASS) {`
);
fs.writeFileSync("api/engine-campaigns.js", engine);

// 2. Patch SystemLogsPage.tsx to show affected users correctly
let logs = fs.readFileSync("src/modules/admin/pages/SystemLogsPage.tsx", "utf8");
logs = logs.replace(
    /log\.details\.forEach\(\(d: any\) => \{/g,
    `log.details.forEach((d: any) => {
                                                                          if (d.affectedUsers && Array.isArray(d.affectedUsers)) {
                                                                              d.affectedUsers.forEach((u: any) => {
                                                                                  const uid = u.id || 'unknown';
                                                                                  if (!groupedByUser[uid]) {
                                                                                      groupedByUser[uid] = {
                                                                                          info: { name: u.name || 'Socio', email: u.email || '' },
                                                                                          actions: []
                                                                                      };
                                                                                  }
                                                                                  groupedByUser[uid].actions.push({...d, affectedUsers: undefined});
                                                                              });
                                                                              return;
                                                                          }`
);
fs.writeFileSync("src/modules/admin/pages/SystemLogsPage.tsx", logs);
