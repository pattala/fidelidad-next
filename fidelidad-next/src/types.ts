export interface Pet {
    id: string;
    name: string;
    breed: string;
    age: string;
    brand: string;
    variant: string;
    photoUrl?: string;
    frequencyDays: number;
    lastPurchaseDate?: any;
    receiveAlerts: boolean;
    createdAt: any;
    foodBrand?: string;
}

export interface Client {
    id: string;
    name: string;
    email: string;
    dni: string;
    phone: string;
    role?: string;
    socioNumber?: string;
    points: number;
    accumulated_balance?: number;
    accumulated_balance_updated_at?: any;
    tags?: string[];
    fcmToken?: string;
    createdAt?: any;
    // Address fields
    calle?: string;
    piso?: string;
    depto?: string;
    provincia?: string;
    partido?: string;
    localidad?: string;
    cp?: string;
    formatted_address?: string;
    lastLocation?: {
        lat: number;
        lng: number;
        timestamp: any;
    };
    termsAccepted?: boolean;
    termsAcceptedAt?: any;
    visitCount?: number;
    lastActive?: any;
    permissions?: {
        notifications?: {
            status: string;
            updatedAt: number;
            deniedCount: number;
            nextPrompt: number;
            pc_dismissedCount?: number;
            mobile_dismissedCount?: number;
            platforms?: string[];
        };
        geolocation?: {
            status: string;
            updatedAt: number;
            deniedCount: number;
            nextPrompt: number;
            mobile_dismissedCount?: number;
        };
    };
    expiringPoints?: number;
    expirationDetails?: Array<{ date: any; points: number }>;
    totalSpent?: number;
    redeemedPoints?: number;
    redeemedValue?: number;
    registrationDate?: any;
    source?: 'pwa' | 'local';
    birthDate?: string; // Format: YYYY-MM-DD
    // Referrals
    referralCode?: string;
    referredBy?: string; // UID of the referrer
    nextExpirationDate?: string | null;
    nextExpirationAmount?: number;
    lastExpirationNotice?: string | null;
    referralStats?: {
        count: number;
        pointsEarned: number;
        processed?: boolean;
        processedAt?: any;
    };
    isTestUser?: boolean;
    pwaInstalled?: boolean; // Nueva: Flag para saber si el usuario instaló la App
    pets?: Pet[];
}

export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL?: string | null;
}

export type MessagingChannel = 'whatsapp' | 'email' | 'push';

export interface AppConfig {
    // Branding
    siteName: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor?: string;
    logoUrl: string;
    logoSize?: number;
    pwaPaddingTop?: number; // Padding superior en píxeles para páginas de la PWA
    siteNameFont?: string;
    siteNameSize?: number;
    siteNameAlignment?: 'left' | 'center' | 'right';

    // Contacto & Redes
    contact?: {
        whatsapp?: string; // Different from messaging.whatsappPhoneNumber? Maybe keep separate as "Display/Support" number vs "System" number, or sync them. User said "numero de contacto".
        email?: string;
        instagram?: string;
        facebook?: string;
        website?: string;
        termsAndConditions?: string; // URL for TyC (Legacy/External)
        termsContent?: string; // Markdown/Text content for internal TyC
        pwaUrl?: string; // URL for the client application
        address?: string; // Dirección del local
        openingHours?: string; // Horarios de atención
    };

    // Reglas del Negocio (Points Logic)
    pointsPerPeso?: number;
    pointsMoneyBase?: number;
    // Point Valorization
    pointValue?: number; // Used for 'manual' method
    useAutomaticPointValue?: boolean; // @deprecated: Migration to calculationMethod
    pointCalculationMethod?: 'manual' | 'average' | 'budget';
    pointValueBudget?: number; // Used for 'budget' method

    // Extended Branding
    sectionTitleColor?: string;
    linkColor?: string;

    welcomePoints?: number;
    enableWelcomeBonus?: boolean;
    enableWelcomeMessage?: boolean;
    birthdayPoints?: number;
    enableBirthdayBonus?: boolean;
    enableBirthdayMessage?: boolean;
    enableExternalIntegration?: boolean;

    // Gamification & Bonos
    enableAddressBonus?: boolean;
    pointsForAddress?: number;

    // Vencimiento por Rangos
    expirationRules?: Array<{
        minPoints: number;
        maxPoints: number | null;
        validityDays: number;
    }>;

    // Mensajería
    messaging?: {
        emailEnabled: boolean;
        whatsappEnabled: boolean;
        pushEnabled: boolean;
        whatsappPhoneNumber?: string;
        whatsappDefaultMessage?: string;

        eventConfigs?: {
            welcome?: { channels: MessagingChannel[] };
            pointsAdded?: { channels: MessagingChannel[] };
            redemption?: { channels: MessagingChannel[] };
            campaign?: { channels: MessagingChannel[] };
            offer?: { channels: MessagingChannel[] };
            birthday?: { channels: MessagingChannel[] };
            referralReward?: { channels: MessagingChannel[] };
            referralPoints?: { channels: MessagingChannel[] };
            expirationWarning?: { channels: MessagingChannel[] };
            petFoodAlert?: { channels: MessagingChannel[] };
        };

        templates?: {
            pointsAdded?: string;
            redemption?: string;
            welcome?: string;
            campaign?: string;
            offer?: string;
            flashOffer?: string;
            birthday?: string;
            birthdaySimple?: string;
            expirationWarning?: string; // Tono: Tenés {puntos} pts para gastar antes del {fecha}! Mirá lo que podés llevarte →
            referralChallenge?: string;
            referralReward?: string;
            referralPoints?: string;
            petFoodAlert?: string;
        };
        enableExpirationWarnings?: boolean;
        repeatExpirationWarnings?: boolean;
        expirationWarningDays?: number;
        automaticCheckHour?: number; // 0-23
        expirationReminderIntervalDays?: number; // Motor Automático Diario
        engineAllowedStartHour?: number; // Default 9
        engineAllowedEndHour?: number;
        enableDashboardTrigger?: boolean;
        enableClientTrigger?: boolean;
        enableExtensionTrigger?: boolean;
        enableQStashTrigger?: boolean;
        notificationPromptIntervalDays?: number; // Días para repetir aviso de permisos
        enablePermissionPromptRepetition?: boolean; // Nuevo: Toggle para encender/apagar re-preguntas PWA
        enableLargePrompt?: boolean; // Nuevo: Toggle para encender/apagar carteles grandes (Fase 1)
        enableContextualNotifPrompt?: boolean; // Banner contextual de notif al ganar puntos
        enableContextualGeoPrompt?: boolean; // Banner contextual de geo al visitar Premios
        maxContextualDismissals?: number; // @deprecated
        maxLargePromptDismissals?: number; // @deprecated
        maxLargePromptDismissalsPC?: number;
        maxLargePromptDismissalsMobile?: number;
        maxContextualDismissalsPC?: number;
        maxContextualDismissalsMobile?: number;
        mobileCooldownHours?: number; // Cooldown para móviles en horas (0 = inmediato)
        pwaInstallPromptCooldownHours?: number; // Nueva: Cooldown para el cartel de "Instalar" pos-compra
        pwaInstallPromptMaxAttempts?: number; // Nueva: Máximo de intentos para el cartel "Instalar"
        pwaInstallPromptResetDays?: number; // Nueva: Días para reiniciar el ciclo de intentos (ej. 30 días)
        enablePwaInstallPromptRepetition?: boolean; // Nueva: Toggle para activar el reinicio del ciclo
    };

    // Sistema de Referidos
    referrals?: {
        enabled: boolean;
        pointsForReferrer: number;
        pointsForReferee: number;
        rewardCriteria: 'first_transaction' | 'registration';
        challenge?: {
            enabled: boolean;
            startDate: string; // YYYY-MM-DD
            endDate: string;   // YYYY-MM-DD
            tiers: Array<{
                count: number;
                bonus: number;
            }>;
            isInternal?: boolean;
        };
    };
    enableDateSimulator?: boolean;
    simulatedOffsetDays?: number;
    enableDuplicateControl?: boolean;
    pwaIconUrl?: string;
    carouselSpeedSeconds?: number;
    enablePetModule?: boolean;
}

export interface Prize {
    id: string;
    name: string;
    pointsRequired: number;
    stock: number;
    description?: string;
    active: boolean;
    imageUrl?: string;
    cashValue?: number; // Valor en pesos para reportes
    isInternal?: boolean;
}
