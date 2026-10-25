export const suspensionOffset = (width:number,t:number,playing:boolean) => playing
    ? Math.round(width*.009*(Math.sin(t*9)+Math.sin(t*15)*.25)) : 0;

// The road and tire phase share one accumulated distance, including coasting.
export const rollingWheelFrame = (distance:number) => ((Math.floor(distance*1.5)%8)+8)%8;
