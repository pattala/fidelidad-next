export interface Client {
    id: string;
    name: string;
    email: string;
    dni: string;
    phone: string;
    socioNumber?: string;
    points: number;
    accumulated_balance?: number;
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
        };
        geolocation?: {
            status: string;
            updatedAt: number;
            deniedCount: number;
            nextPrompt: number;
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
    pwaPaddingTop?: number; // Padding superior en píxeles para páginas de la PWA

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
            expirationWarning?: { channels: MessagingChannel[] };
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
            referralReward?: string;
            referralPoints?: string;
            expirationWarning?: string;
        };
        enableExpirationWarnings?: boolean;
        repeatExpirationWarnings?: boolean;
        expirationWarningDays?: number;
        automaticCheckHour?: number; // 0-23
    };

    // Sistema de Referidos
    referrals?: {
        enabled: boolean;
        pointsForReferrer: number;
        pointsForReferee: number;
        rewardCriteria: 'first_transaction' | 'registration';
    };
    enableDateSimulator?: boolean;
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
}
