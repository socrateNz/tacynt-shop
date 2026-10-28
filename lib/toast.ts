import { Toast } from "@base-ui/react/toast";

// Singleton plutôt que useToastManager() : doit pouvoir être appelé depuis
// n'importe où, y compris hors composant React (ex. le callback setInterval
// de app/(admin)/online-orders/live-updates.tsx) — exactement le cas d'usage
// documenté de createToastManager, passé ensuite à <Toast.Provider
// toastManager={toastManager}> pour qu'il rende ce qui y est ajouté.
export const toastManager = Toast.createToastManager();
