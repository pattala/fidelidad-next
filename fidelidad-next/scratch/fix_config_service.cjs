const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/services/configService.ts');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /export const DEFAULT_TEMPLATES = \{[\s\S]*?\};/;

const correctTemplates = `export const DEFAULT_TEMPLATES = {
    whatsappDefaultMessage: "Hola {nombre}, ¡gracias por tu visita! Tenés {puntos} puntos disponibles. 👋",
    pointsAdded: "¡Hola {nombre}! 🎉 Sumaste {puntos} puntos. Tu nuevo saldo es {saldo} 🪙",
    redemption: "¡Felicidades {nombre}! 🎁 Canjeaste {premio}. Código: {codigo}. ¡Que lo disfrutes! 🏷️",
    welcome: "¡Bienvenido a {siteName}, {nombre}! 🎉 Ya tienes {puntos} puntos de regalo. 🎁",
    campaign: "📢 ¡Nueva Campaña!: {titulo}. {descripcion}. ¡No te la pierdas! 🚀",
    offer: "🎁 ¡Oferta Especial! {titulo}: {detalle}. Válido hasta el {vencimiento}. ⏰",
    flashOffer: "⚡ ¡OFERTA FLASH! {titulo}: {detalle}. Solo disponible hoy hasta las {horario} hs. ⏳",
    birthday: "¡Feliz cumpleaños, {nombre}! 🎂🎉 Te regalamos {puntos} puntos para que los disfrutes. ¡Que pases un gran día! 🎁",
    birthdaySimple: "¡Feliz cumpleaños, {nombre}! 🎂🎉 Esperamos que pases un día increíble. ¡Te enviamos un gran saludo! 🎈",
    referralReward: "¡Hola {nombre}! 🎉 Ganaste {puntos} puntos porque tu amigo {amigo} comenzó a usar {siteName}. ¡Gracias por recomendarnos! 🎁",
    referralPoints: "🎉 ¡Buenas noticias! Ganaste {puntos} puntos porque {nombre_referido} se unió a {siteName}. ¡Gracias por recomendarnos! 🚀",
    expirationWarning: "¡Hola {nombre}! ⏰ Tenés {puntos} puntos para gastar antes del {fecha}. ¡Canjealos hoy por un premio antes de que se venzan! 🎁🏃",
    referralChallenge: "¡NUEVO DESAFÍO ACTIVO! 🎯 Traé amigos a {siteName} y ganá bonos extra de puntos por tiempo limitado. ¡Entrá ahora para participar! 🚀",
    petFoodAlert: "¡Hola {nombre}! 🐾 A {mascota} le queda poco alimento {marca}. ¡Vení a buscar su bolsa y seguí sumando puntos! 🐶🛒"
};`;

if (content.match(regex)) {
    content = content.replace(regex, correctTemplates);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully replaced DEFAULT_TEMPLATES in configService.ts");
} else {
    console.log("Could not find DEFAULT_TEMPLATES using regex!");
}
