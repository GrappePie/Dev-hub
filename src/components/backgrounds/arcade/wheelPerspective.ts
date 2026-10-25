export interface WheelTexture {pixels:Uint8ClampedArray;width:number;height:number}
export const wheelViews=[0,-55,-78,-90,0,55,78,90] as const;
const wrap=(value:number)=>(value%1+1)%1;
const sample=(texture:WheelTexture,u:number,v:number)=>{
    const x=Math.max(0,Math.min(texture.width-1,Math.floor(u*texture.width)));
    const y=Math.max(0,Math.min(texture.height-1,Math.floor(v*texture.height)));
    const i=(y*texture.width+x)*4;
    return texture.pixels[i+3]>80?[texture.pixels[i],texture.pixels[i+1],texture.pixels[i+2]]:[23,26,31];
};
/** Orthographic ray/cylinder projection. Rotation changes UVs only, never geometry. */
export const perspectiveWheelFrames=(side:WheelTexture,tread:WheelTexture,yawDegrees:number,size=160,direction=1)=>{
    const yaw=yawDegrees*Math.PI/180,s=Math.sin(yaw),c=Math.cos(yaw);
    const halfWidth=.45,scale=size*.4;
    // Fixed surface registration is shared by all eight cels.
    const surfaces:Array<{i:number;face:boolean;u:number;v:number;light:number}>=[];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const px=(x+.5-size/2)/scale,py=(y+.5-size/2)/scale;
        // Rounded shoulders avoid a rectangular tread profile in rear views.
        const shoulder=.1;
        const distance=(z:number)=>{
            const axial=px*s+z*c,radial=Math.hypot(px*c-z*s,py);
            const a=radial-(1-shoulder),b=Math.abs(axial)-(halfWidth-shoulder);
            return Math.hypot(Math.max(a,0),Math.max(b,0))+Math.min(Math.max(a,b),0)-shoulder;
        };
        let z=2,hit=false;
        for(let step=0;step<96&&z>=-2;step++){
            const d=distance(z);
            if(d<.0005){hit=true;break;}
            z-=Math.max(d,.0005);
        }
        if(!hit)continue;
        const face=Math.abs(px*s+z*c)>=halfWidth-.001;
        const u=px*c-z*s,axial=px*s+z*c;
        const normalZ=face?c:z-axial*c;
        const light=face?1:Math.max(.46,Math.min(1.08,.73+normalZ*.23-py*.13));
        surfaces.push({i:(y*size+x)*4,face,u:face?u:axial/halfWidth,v:face?py:Math.atan2(py,u),light});
    }
    return Array.from({length:8},(_,phase)=>{
        const pixels=new Uint8ClampedArray(size*size*4),angle=phase*Math.PI/4*direction;
        const cos=Math.cos(angle),sin=Math.sin(angle);
        for(const point of surfaces){
            let color:number[];
            if(point.face){
                const x=point.u*cos+point.v*sin,y=-point.u*sin+point.v*cos;
                // Balanced side texture has an invariant radius of .465 in its cell.
                color=sample(side,.5+x*.465,.5+y*.465);
            }else{
                // The texture wraps around the cylinder; its blocks travel around
                // the circumference while the camera and silhouette stay fixed.
                color=sample(tread,(point.u+1)/2,wrap(point.v/(Math.PI*2)*3-phase/8*3*direction));
            }
            for(let channel=0;channel<3;channel++)pixels[point.i+channel]=Math.round(color[channel]*point.light);
            pixels[point.i+3]=255;
        }
        return pixels;
    });
};
