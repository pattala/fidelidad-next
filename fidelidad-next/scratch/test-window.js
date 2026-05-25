const now = new Date("2026-05-24T23:55:00-03:00");
const currentH = now.getHours();
const allowedStart = 9;
const allowedEnd = 6;
let isWithinNotificationWindow = true;
if (allowedStart !== allowedEnd) {
    if (allowedStart < allowedEnd) {
        isWithinNotificationWindow = (currentH >= allowedStart && currentH < allowedEnd);
    } else {
        isWithinNotificationWindow = (currentH >= allowedStart || currentH < allowedEnd);
    }
}
console.log("currentH:", currentH, "isWithin:", isWithinNotificationWindow);
