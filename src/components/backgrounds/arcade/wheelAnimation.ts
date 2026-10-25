/** Register the generated tire and rim to concentric circles before rotation. */
export const balancedWheelFrames=(source:Uint8ClampedArray,width:number,height:number,size=160)=>{
    const cx=width*.491,cy=height*.499,radius=size*.465,center=size/2;
    const rays=720,outer=new Float64Array(rays),rim=new Float64Array(rays);
    const pixel=(x:number,y:number)=>{
        const ix=Math.round(x),iy=Math.round(y);
        return ix<0||iy<0||ix>=width||iy>=height?-1:(iy*width+ix)*4;
    };
    for(let ray=0;ray<rays;ray++){
        const angle=ray/rays*Math.PI*2,dx=Math.cos(angle),dy=Math.sin(angle);
        outer[ray]=width*.465;rim[ray]=width*.31;
        for(let r=width*.22;r<width*.51;r++){
            const p=pixel(cx+dx*r,cy+dy*r);if(p<0||source[p+3]<128)continue;
            outer[ray]=r;
            const max=Math.max(source[p],source[p+1],source[p+2]);
            const min=Math.min(source[p],source[p+1],source[p+2]);
            if(r<width*.345&&max>150&&max-min<65)rim[ray]=r;
        }
    }
    return Array.from({length:8},(_,phase)=>{
        const frame=new Uint8ClampedArray(size*size*4);
        for(let y=0;y<size;y++)for(let x=0;x<size;x++){
            const dx=x+.5-center,dy=y+.5-center,normalized=Math.hypot(dx,dy)/radius;
            if(normalized>1)continue;
            const angle=Math.atan2(dy,dx)-phase*Math.PI/4;
            const ray=((Math.round(angle/(Math.PI*2)*rays)%rays)+rays)%rays;
            const r=normalized<.65?normalized/.65*rim[ray]
                :rim[ray]+(normalized-.65)/.35*(outer[ray]-rim[ray]);
            const p=pixel(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r),out=(y*size+x)*4;
            if(p>=0&&source[p+3]>128)frame.set(source.subarray(p,p+3),out);
            else frame.set([23,26,31],out);
            frame[out+3]=255;
        }
        return frame;
    });
};
