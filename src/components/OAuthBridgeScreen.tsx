const OAuthBridgeScreen = () => (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="pixel-box p-8 max-w-lg w-full">
            <p className="font-display text-[9px] text-primary mb-3">CONECTANDO SPOTIFY...</p>
            <p className="text-sm text-muted-foreground">
                Validando autorizacion y preparando el reproductor.
            </p>
        </div>
    </div>
);

export default OAuthBridgeScreen;
