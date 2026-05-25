const fs = require("fs");
fs.writeFileSync("C:/Users/pablo/.gemini/antigravity/brain/b8281711-faba-4a27-b502-63e9c4551f25/task.md", `# Refactorización de Mensajería y Notificaciones

- [/] Modificar ConfigPage.tsx
  - Reestructurar la pestaña de Mensajería en tarjetas por Evento.
  - Implementar campos de "Título", "Cuerpo" y "Cuerpo WhatsApp" para todas las tarjetas.
- [ ] Actualizar CampaignsPage.tsx
  - Asegurar que el CSV de WhatsApp de campañas lea los campos whatsappFlashOffer, whatsappOffer y whatsappCampaign.
- [ ] Actualizar Backend (Títulos dinámicos)
  - api/engine-campaigns.js
  - api/assign-points.js
  - api/redeem-prize.js
  - api/engine-daily.js
  - api/users.js
- [ ] Validar y probar localmente.
`);
