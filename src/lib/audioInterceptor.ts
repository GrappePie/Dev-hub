declare global {
    interface Window {
        __audioInterceptor?: {
            getLatestAnalyser(): AnalyserNode | null;
        };
    }
}

export const getInterceptedAnalyser = (): AnalyserNode | null =>
    window.__audioInterceptor?.getLatestAnalyser() ?? null;
