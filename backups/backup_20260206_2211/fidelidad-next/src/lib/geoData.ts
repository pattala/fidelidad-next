export const PROVINCIAS = [
    "CABA", "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
    "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
    "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
    "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

export const BARRIOS_CABA = [
    "Agronomía", "Almagro", "Balvanera", "Barracas", "Belgrano", "Boedo", "Caballito",
    "Chacarita", "Coghlan", "Colegiales", "Constitución", "Flores", "Floresta",
    "La Boca", "La Paternal", "Liniers", "Mataderos", "Monte Castro", "Montserrat",
    "Nueva Pompeya", "Núñez", "Palermo", "Parque Avellaneda", "Parque Chacabuco",
    "Parque Chas", "Parque Patricios", "Puerto Madero", "Recoleta", "Retiro",
    "Saavedra", "San Cristóbal", "San Nicolás", "San Telmo", "Vélez Sarsfield",
    "Versalles", "Villa Crespo", "Villa del Parque", "Villa Devoto", "Villa General Mitre",
    "Villa Lugano", "Villa Luro", "Villa Ortúzar", "Villa Pueyrredón", "Villa Real",
    "Villa Riachuelo", "Villa Santa Rita", "Villa Soldati", "Villa Urquiza"
];

export const BA_LOCALIDADES_BY_PARTIDO: Record<string, string[]> = {
    "San Isidro": ["Béccar", "Acassuso", "Martínez", "San Isidro", "Villa Adelina", "Boulogne Sur Mer", "La Horqueta"],
    "Vicente López": ["Olivos", "Florida", "Florida Oeste", "La Lucila", "Munro", "Villa Martelli", "Carapachay", "Vicente López"],
    "Tigre": ["Tigre", "Don Torcuato", "General Pacheco", "El Talar", "Benavídez", "Rincón de Milberg", "Dique Luján", "Nordelta"],
    "San Fernando": ["San Fernando", "Victoria", "Virreyes", "Islas"],
    "San Martín": ["San Martín", "Villa Ballester", "José León Suárez", "Villa Lynch", "Villa Maipú", "Billinghurst", "Chilavert", "Loma Hermosa"],
    "Tres de Febrero": ["Caseros", "Ciudad Jardín", "Santos Lugares", "Villa Bosch", "Loma Hermosa", "Ciudadela", "José Ingenieros", "Saénz Peña"],
    "Hurlingham": ["Hurlingham", "William C. Morris", "Villa Tesei"],
    "Ituzaingó": ["Ituzaingó", "Villa Udaondo"],
    "Morón": ["Morón", "Haedo", "El Palomar", "Castelar"],
    "La Matanza": ["San Justo", "Ramos Mejía", "Lomas del Mirador", "La Tablada", "Isidro Casanova", "González Catán", "Ciudad Evita", "Virrey del Pino", "Tapiales", "Aldo Bonzi", "Villa Luzuriaga", "Rafael Castillo"],
    "Merlo": ["Merlo", "San Antonio de Padua", "Libertad", "Mariano Acosta", "Pontevedra"],
    "Moreno": ["Moreno", "La Reja", "Paso del Rey", "Cuartel V", "Francisco Álvarez", "Trujui"],
    "Ezeiza": ["Ezeiza", "Tristán Suárez", "La Unión", "Carlos Spegazzini", "Canning"],
    "Esteban Echeverría": ["Monte Grande", "9 de Abril", "Canning", "El Jagüel", "Luis Guillón"],
    "Lanús": ["Lanús Oeste", "Lanús Este", "Remedios de Escalada", "Monte Chingolo", "Gerli (Lanús)"],
    "Lomas de Zamora": ["Lomas de Zamora", "Banfield", "Temperley", "Turdera", "Llavallol", "Villa Centenario", "Villa Fiorito"],
    "Avellaneda": ["Avellaneda Centro", "Dock Sud", "Sarandí", "Wilde", "Gerli (Avellaneda)", "Villa Domínico", "Piñeyro"],
    "Quilmes": ["Quilmes", "Bernal", "Don Bosco", "Ezpeleta", "Villa La Florida", "San Francisco Solano"],
    "Berazategui": ["Berazategui", "Ranelagh", "Sourigues", "Hudson", "Gutiérrez", "Plátanos", "Villa España", "Pereyra"],
    "Florencio Varela": ["Florencio Varela", "Bosques", "Zeballos", "Villa Vatteone", "Ingeniero Allan", "La Capilla"],
    "Almirante Brown": ["Adrogué", "Burzaco", "Rafael Calzada", "Longchamps", "Glew", "San José", "Claypole", "Malvinas Argentinas", "Ministro Rivadavia", "José Mármol"],
    "Pilar": ["Pilar", "Del Viso", "Manzanares", "Presidente Derqui", "Fátima", "Villa Rosa", "Champagnat", "Lagomarsino", "Manuel Alberti"],
    "Escobar": ["Belén de Escobar", "Ingeniero Maschwitz", "Garín", "Maquinista Savio", "Loma Verde"],
    "José C. Paz": ["José C. Paz"],
    "Malvinas Argentinas": ["Los Polvorines", "Grand Bourg", "Tortuguitas", "Ing. Pablo Nogués", "Villa de Mayo", "Tierras Altas"],
    "San Miguel": ["San Miguel", "Bella Vista", "Muñiz", "Santa María"],
    "Zárate": ["Zárate", "Lima"],
    "Campana": ["Campana"],
    "Luján": ["Luján", "Open Door", "Torres", "Cortínez", "Olivera", "Jáuregui"],
    "Mercedes": ["Mercedes", "Gowland", "Altamira"],
    "Bahía Blanca": ["Bahía Blanca", "Ingeniero White", "Cabildo", "Cerri"],
    "Gral. Pueyrredón": ["Mar del Plata", "Batán", "Sierra de los Padres"],
    "Tandil": ["Tandil", "Gardey", "María Ignacia (Vela)"],
    "Necochea": ["Necochea", "Quequén"],
    "La Plata": ["La Plata", "City Bell", "Villa Elisa", "Gonnet", "Manuel B. Gonnet", "Tolosa", "Los Hornos", "Villa Elvira", "Altos de San Lorenzo", "San Carlos"],
    "Ensenada": ["Ensenada", "Punta Lara", "El Dique"],
    "Berisso": ["Berisso", "Villa Zula", "La Balandra"]
};

export const PARTIDOS_BUENOS_AIRES = Object.keys(BA_LOCALIDADES_BY_PARTIDO).sort();
