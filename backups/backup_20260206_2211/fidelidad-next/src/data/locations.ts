export const ARGENTINA_LOCATIONS: Record<string, Record<string, string[]>> = {
    "Capital Federal": {
        "CABA": [
            "Agronomía", "Almagro", "Balvanera", "Barracas", "Belgrano", "Boedo", "Caballito", "Chacarita", "Coghlan", "Colegiales",
            "Constitución", "Flores", "Floresta", "La Boca", "La Paternal", "Liniers", "Mataderos", "Monte Castro", "Monserrat",
            "Nueva Pompeya", "Núñez", "Palermo", "Parque Avellaneda", "Parque Chacabuco", "Parque Chas", "Parque Patricios",
            "Puerto Madero", "Recoleta", "Retiro", "Saavedra", "San Cristóbal", "San Nicolás", "San Telmo", "Vélez Sársfield",
            "Versalles", "Villa Crespo", "Villa del Parque", "Villa Devoto", "Villa General Mitre", "Villa Lugano", "Villa Luro",
            "Villa Ortúzar", "Villa Pueyrredón", "Villa Real", "Villa Riachuelo", "Villa Santa Rita", "Villa Soldati", "Villa Urquiza"
        ]
    },
    "Buenos Aires": {
        // GBA NORTE
        "Escobar": ["Belén de Escobar", "Garín", "Ingeniero Maschwitz", "Matheu", "Maquinista Savio"],
        "San Isidro": ["San Isidro", "Acassuso", "Beccar", "Boulogne", "Martínez", "Villa Adelina"],
        "Vicente López": ["Vicente López", "Florida", "Florida Oeste", "La Lucila", "Munro", "Olivos", "Villa Adelina", "Villa Martelli", "Carapachay"],
        "Tigre": ["Tigre", "Don Torcuato", "General Pacheco", "El Talar", "Benavídez", "Rincón de Milberg", "Troncos del Talar"],
        "San Fernando": ["San Fernando", "Victoria", "Virreyes"],
        "San Miguel": ["San Miguel", "Bella Vista", "Muñiz", "Santa María"],
        "José C. Paz": ["José C. Paz"],
        "Malvinas Argentinas": ["Los Polvorines", "Grand Bourg", "Tortuguitas"],
        "San Martín": ["San Martín", "Villa Ballester", "José León Suárez", "San Andrés"],

        // GBA SUR
        "Avellaneda": ["Avellaneda", "Dock Sud", "Gerli", "Sarandí", "Villa Domínico", "Wilde"],
        "Lanús": ["Lanús", "Gerli", "Monte Chingolo", "Remedios de Escalada", "Valentín Alsina"],
        "Lomas de Zamora": ["Lomas de Zamora", "Banfield", "Temperley", "Turdera", "Llavallol"],
        "Quilmes": ["Quilmes", "Bernal", "Don Bosco", "Ezpeleta", "San Francisco Solano", "Villa La Florida"],
        "Almirante Brown": ["Adrogué", "Burzaco", "Glew", "Claypole", "Rafael Calzada", "Longchamps"],

        // GBA OESTE
        "La Matanza": ["San Justo", "Ramos Mejía", "González Catán", "Gregorio de Laferrere", "Virrey del Pino", "Isidro Casanova"],
        "Morón": ["Morón", "Castelar", "Haedo", "El Palomar", "Villa Sarmiento"],
        "Hurlingham": ["Hurlingham", "Villa Tesei", "William C. Morris"],
        "Ituzaingó": ["Ituzaingó", "Villa Udaondo"],
        "Merlo": ["Merlo", "San Antonio de Padua", "Libertad", "Mariano Acosta"],

        // OTROS
        "La Plata": ["La Plata", "City Bell", "Tolosa", "Villa Elisa", "Gonnet"],
        "Mar del Plata (Gral. Pueyrredón)": ["Mar del Plata", "Batán"],
        "Pilar": ["Pilar", "Del Viso", "Derqui", "Fatima"],
        "Luján": ["Luján", "Jáuregui", "Olivera"],
    },
    // Generic fallbacks for other provinces (examples)
    "Córdoba": {
        "Capital": ["Córdoba Capital"],
        "Villa Carlos Paz": ["Villa Carlos Paz"],
        "Río Cuarto": ["Río Cuarto"]
    },
    "Santa Fe": {
        "Rosario": ["Rosario", "Funes", "Granadero Baigorria"],
        "Santa Fe (Capital)": ["Santa Fe"]
    },
    "Mendoza": {
        "Capital": ["Mendoza"],
        "San Rafael": ["San Rafael"]
    }
};

export const getProvinces = () => Object.keys(ARGENTINA_LOCATIONS);

