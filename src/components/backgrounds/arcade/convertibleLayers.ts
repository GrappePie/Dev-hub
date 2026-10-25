import type {SpriteRect} from "./spriteBounds";
type Point=[number,number];
const inside=(x:number,y:number,points:Point[])=>{
    let hit=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [ax,ay]=points[i],[bx,by]=points[j];
        if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
    }
    return hit;
};
const sideWheels:Point[][]=[
    [[0,.45],[.045,.38],[.085,.47],[.09,.8],[.06,.85],[.015,.8]],
    [[.08,.58],[.12,.49],[.17,.55],[.23,.75],[.26,.87],[.25,.97],[.22,1],[.12,1],[.08,.94]],
    [[.96,.70],[.98,.83],[.97,.96],[.94,1],[.80,1],[.81,.94],[.87,.91],[.93,.83]],
];
const rearWheels:Point[][]=[
    [[0,.64],[.055,.7],[.14,.85],[.15,1],[.025,1],[0,.94]],
    [[1,.64],[.945,.7],[.86,.85],[.85,1],[.975,1],[1,.94]],
];
export const splitConvertiblePixels=(source:Uint8ClampedArray,imageWidth:number,frame:SpriteRect,column:number)=>{
    const body=new Uint8ClampedArray(frame.w*frame.h*4),wheels=new Uint8ClampedArray(body.length);
    const owners=new Uint8Array(frame.w*frame.h);
    const shapes=column===1?rearWheels:sideWheels.map(shape=>shape.map(([x,y]):Point=>[column===2?1-x:x,y]));
    for(let y=0;y<frame.h;y++)for(let x=0;x<frame.w;x++){
        const src=((frame.y+y)*imageWidth+frame.x+x)*4,dst=(y*frame.w+x)*4;
        const redPaint=source[src]>source[src+1]*1.3&&source[src]>source[src+2]*1.3;
        let owner=0;
        if(!redPaint)for(let shape=shapes.length-1;shape>=0;shape--){
            if(inside(x/frame.w,y/frame.h,shapes[shape])){owner=shape+1;break;}
        }
        const wheel=owner>0;owners[y*frame.w+x]=owner;
        (wheel?wheels:body).set(source.subarray(src,src+4),dst);
    }
    return {body,wheels,owners};
};
export interface WheelMount {row:number;x:number;y:number;diameter:number;owner:number}
export const convertibleWheelMounts:readonly (readonly WheelMount[])[]=[
    [{row:2,x:.055,y:.61,diameter:.20,owner:1},{row:2,x:.16,y:.75,diameter:.28,owner:2},{row:7,x:.895,y:.74,diameter:.29,owner:3}],
    [{row:3,x:.075,y:.75,diameter:.30,owner:1},{row:7,x:.925,y:.75,diameter:.30,owner:2}],
    [{row:3,x:.105,y:.74,diameter:.29,owner:3},{row:6,x:.84,y:.75,diameter:.28,owner:2},{row:6,x:.945,y:.61,diameter:.20,owner:1}],
];
export const makeConvertibleLayers=(source:Uint8ClampedArray,imageWidth:number,frame:SpriteRect,column:number,rotation?:CanvasImageSource)=>{
    const separated=splitConvertiblePixels(source,imageWidth,frame,column);
    const canvasFor=(pixels:Uint8ClampedArray)=>{
        const canvas=document.createElement("canvas");canvas.width=frame.w;canvas.height=frame.h;
        const ctx=canvas.getContext("2d");
        if(ctx){const data=ctx.createImageData(frame.w,frame.h);data.data.set(pixels);ctx.putImageData(data,0,0);}
        return canvas;
    };
    const originalWheels=canvasFor(separated.wheels);
    if(!rotation)return {body:canvasFor(separated.body),originalWheels,wheels:Array.from({length:8},()=>originalWheels)};
    const wheels=Array.from({length:8},(_,phase)=>{
        const overlay=document.createElement("canvas");overlay.width=frame.w;overlay.height=frame.h;
        const ctx=overlay.getContext("2d");if(!ctx)return originalWheels;
        ctx.imageSmoothingEnabled=false;
        const pixels=new Uint8ClampedArray(separated.wheels);
        // Front axle first, rear axle last. Each wheel also owns a disjoint
        // occlusion mask so its sprite cannot bleed into the adjacent wheel.
        for(const mount of [...convertibleWheelMounts[column]].sort((a,b)=>a.y-b.y)){
            ctx.clearRect(0,0,frame.w,frame.h);
            // Uniform scaling only. All cels share exactly the same pivot and bounds.
            const size=frame.w*mount.diameter/.8;
            ctx.drawImage(rotation,phase*160,mount.row*160,160,160,
                Math.round(frame.w*mount.x-size/2),Math.round(frame.h*mount.y-size/2),Math.round(size),Math.round(size));
            const painted=ctx.getImageData(0,0,frame.w,frame.h).data;
            for(let i=0;i<pixels.length;i+=4){
                if(pixels[i+3]&&separated.owners[i/4]===mount.owner)
                    pixels.set(painted[i+3]>128?painted.subarray(i,i+3):[20,22,28],i);
            }
        }
        return canvasFor(pixels);
    });
    return {body:canvasFor(separated.body),originalWheels,wheels};
};
