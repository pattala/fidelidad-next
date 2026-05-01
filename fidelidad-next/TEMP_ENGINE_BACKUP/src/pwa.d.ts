/// <reference types="vite-plugin-pwa/react" />
declare module 'virtual:pwa-register/react' {
    import { Dispatch, SetStateAction } from 'react';
    import { RegisterSWOptions } from 'vite-plugin-pwa/types';

    export type { RegisterSWOptions };

    export function useRegisterSW(options?: RegisterSWOptions): {
        offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
        needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
        updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
    };
}
