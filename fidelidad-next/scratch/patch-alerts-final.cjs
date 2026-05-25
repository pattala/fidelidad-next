const fs = require("fs");
let alerts = fs.readFileSync("src/modules/admin/components/GlobalAlerts.tsx", "utf8");

// We'll replace the full definition of pendingC and procC
const pendingC_target = `    const pendingC = campaignAlerts.filter(u => {
        if (processedAlerts[u.alertId]) return false;
        const camp = campaignsMap.get(u.campId);
          if (!camp) return false; // Excluye campañas huérfanas pero NO las desactivadas
        
        // Excluir si la fecha de inicio es futura en la simulación
        const campStartDate = camp.startDate || camp.flashDate || null;
        if (campStartDate && campStartDate > todayStr) return false;
        // Excluir si la fecha de fin ya pasó en la simulación
        if (camp.endDate && camp.endDate < todayStr) return false;

        return true;
    });`;

const procC_target = `    const procC = campaignAlerts.filter(u => {
        if (!processedAlerts[u.alertId]) return false;
        const camp = campaignsMap.get(u.campId);
          if (!camp) return false; // Excluye campañas huérfanas pero NO las desactivadas

        // Excluir si la fecha de inicio es futura en la simulación
        const campStartDate = camp.startDate || camp.flashDate || null;
        if (campStartDate && campStartDate > todayStr) return false;
        // Excluir si la fecha de fin ya pasó en la simulación
        if (camp.endDate && camp.endDate < todayStr) return false;

        return true;
    });`;

alerts = alerts.replace(pendingC_target, `    const pendingC = campaignAlerts.filter(u => !processedAlerts[u.alertId]);`);
alerts = alerts.replace(procC_target, `    const procC = campaignAlerts.filter(u => !!processedAlerts[u.alertId]);`);

fs.writeFileSync("src/modules/admin/components/GlobalAlerts.tsx", alerts);
