// modules/geo-catalogs.js
// Si existen catálogos globales (inyectados), los usamos. Si no, fallback corto.
const _G = (typeof window !== 'undefined' && window.__RAMPET__ && window.__RAMPET__.GEO) || {};

export const CABA_BARRIOS = _G.CABA_BARRIOS || [
  "Agronomía","Almagro","Balvanera","Barracas","Belgrano","Boedo","Caballito","Chacarita","Coghlan",
  "Colegiales","Constitución","Flores","Floresta","La Boca","La Paternal","Liniers","Mataderos","Monte Castro",
  "Montserrat","Nueva Pompeya","Núñez","Palermo","Parque Avellaneda","Parque Chacabuco","Parque Chas",
  "Parque Patricios","Puerto Madero","Recoleta","Retiro","Saavedra","San Cristóbal","San Nicolás","San Telmo",
  "Vélez Sarsfield","Versalles","Villa Crespo","Villa del Parque","Villa Devoto","Villa General Mitre",
  "Villa Lugano","Villa Luro","Villa Ortúzar","Villa Pueyrredón","Villa Real","Villa Riachuelo","Villa Santa Rita",
  "Villa Soldati","Villa Urquiza"
];

export const BA_LOCALIDADES_BY_PARTIDO = _G.BA_LOCALIDADES_BY_PARTIDO || {
  "San Isidro": ["Béccar","Acassuso","Martínez","San Isidro","Villa Adelina","Boulogne Sur Mer","La Horqueta"],
  "Vicente López": ["Olivos","Florida","Florida Oeste","La Lucila","Munro","Villa Martelli","Carapachay","Vicente López"],
  "Tigre": ["Tigre","Don Torcuato","General Pacheco","El Talar","Benavídez","Rincón de Milberg","Dique Luján","Nordelta"],
  "San Fernando": ["San Fernando","Victoria","Virreyes","Islas"],
  "San Martín": ["San Martín","Villa Ballester","José León Suárez","Villa Lynch","Villa Maipú","Billinghurst","Chilavert","Loma Hermosa"],
  "Tres de Febrero": ["Caseros","Ciudad Jardín","Santos Lugares","Villa Bosch","Loma Hermosa","Ciudadela","José Ingenieros","Saénz Peña"],
  "Hurlingham": ["Hurlingham","William C. Morris","Villa Tesei"],
  "Ituzaingó": ["Ituzaingó","Villa Udaondo"],
  "Morón": ["Morón","Haedo","El Palomar","Castelar"],
  "La Matanza": ["San Justo","Ramos Mejía","Lomas del Mirador","La Tablada","Isidro Casanova","González Catán","Ciudad Evita","Virrey del Pino"],
  "Lanús": ["Lanús Oeste","Lanús Este","Remedios de Escalada","Monte Chingolo"],
  "Lomas de Zamora": ["Lomas de Zamora","Banfield","Temperley","Turdera","Llavallol"],
  "Avellaneda": ["Avellaneda","Dock Sud","Sarandí","Wilde","Gerli","Villa Domínico","Piñeyro"],
  "Quilmes": ["Quilmes","Bernal","Don Bosco","Ezpeleta","Villa La Florida","San Francisco Solano"],
  "Berazategui": ["Berazategui","Ranelagh","Sourigues","Hudson","Gutiérrez"],
  "Florencio Varela": ["Florencio Varela","Bosques","Zeballos","Villa Vatteone"],
  "Almirante Brown": ["Adrogué","Burzaco","Rafael Calzada","Longchamps","Glew","San José","Claypole","Malvinas Argentinas (AB)"],
  "Pilar": ["Pilar","Del Viso","Manzanares","Presidente Derqui","Fátima","Villa Rosa","Champagnat"],
  "Escobar": ["Belén de Escobar","Ingeniero Maschwitz","Garín","Maquinista Savio","Loma Verde"],
  "José C. Paz": ["José C. Paz","Tortuguitas (comp.)","Sol y Verde"],
  "Malvinas Argentinas": ["Los Polvorines","Grand Bourg","Tortuguitas","Ing. Pablo Nogués","Villa de Mayo"],
  "San Miguel": ["San Miguel","Bella Vista","Muñiz"],
  "Zárate": ["Zárate","Lima"],
  "Campana": ["Campana"],
  "Luján": ["Luján","Open Door","Torres","Cortínez"],
  "Mercedes": ["Mercedes","Gowland","Altamira"],
  "Bahía Blanca": ["Bahía Blanca","Ingeniero White","Cabildo","Cerri"],
  "Gral. Pueyrredón": ["Mar del Plata","Batán","Sierra de los Padres"],
  "Tandil": ["Tandil","Gardey","María Ignacia (Vela)"],
  "Necochea": ["Necochea","Quequén"]
};
