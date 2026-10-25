import bodyUrl from "@/assets/arcade-convertible-body-v2.png";
import occupantsUrl from "@/assets/arcade-convertible-occupants-v2.png";
import hairUrl from "@/assets/arcade-convertible-hair-v3.png";
import centerHairUrl from "@/assets/arcade-convertible-hair-center-v1.png";
import wheelRotationUrl from "@/assets/arcade-wheel-rotation-v1.png";
import {findSpriteBounds,type SpriteRect} from "./spriteBounds";
import {rollingWheelFrame,suspensionOffset} from "./convertibleMotion";
import {makeConvertibleLayers} from "./convertibleLayers";
interface Atlas {url:string;rows:number;columns?:number;roots?:{x:number;y:number}[];span?:number;image?:HTMLImageElement;frames?:SpriteRect[];failed?:boolean;layers?:ReturnType<typeof makeConvertibleLayers>[];pixels?:Uint8ClampedArray;ready?:boolean}
const body:Atlas={url:bodyUrl,rows:1};
const people:Atlas={url:occupantsUrl,rows:2};
const hair:Atlas={url:hairUrl,rows:2,columns:4};
const centerHair:Atlas={url:centerHairUrl,rows:2,columns:4};
const wheelRotation:Atlas={url:wheelRotationUrl,rows:8,columns:8};
const rebuildBodyLayers=()=>{
    if(body.pixels&&body.image&&body.frames)body.layers=body.frames.map((frame,column)=>
        makeConvertibleLayers(body.pixels!,body.image!.width,frame,column,wheelRotation.ready?wheelRotation.image:undefined));
};
const load=(atlas:Atlas)=>{
    if(atlas.image||atlas.failed)return;
    const image=new Image();atlas.image=image;
    image.onerror=()=>{atlas.failed=true;};
    image.onload=()=>{
        if(atlas===wheelRotation){atlas.ready=true;rebuildBodyLayers();return;}
        const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext("2d");if(!ctx)return;ctx.drawImage(image,0,0);
        const pixels=ctx.getImageData(0,0,image.width,image.height).data;
        const columns=atlas.columns??3;
        const cw=Math.floor(image.width/columns),ch=Math.floor(image.height/atlas.rows);
        atlas.frames=Array.from({length:columns*atlas.rows},(_,i)=>{
            const gutter=atlas===hair||atlas===centerHair?3:0;
            return findSpriteBounds(pixels,image.width,
                {x:i%columns*cw+gutter,y:Math.floor(i/columns)*ch+gutter,w:cw-gutter*2,h:ch-gutter*2},atlas===hair);
        });
        if(atlas===body){atlas.pixels=pixels;rebuildBodyLayers();}
        if(atlas===hair||atlas===centerHair){
            atlas.roots=atlas.frames.map(frame=>{
                const limit=Math.min(frame.w,40);
                let total=0,sumY=0;
                for(let y=0;y<frame.h;y++)for(let x=0;x<limit;x++){
                    const a=pixels[((frame.y+y)*image.width+frame.x+x)*4+3];
                    if(a>80){total+=a;sumY+=(frame.y+y)*a;}
                }
                if(atlas===centerHair){
                    let weight=0,sumX=0;
                    for(let y=0;y<Math.min(45,frame.h);y++)for(let x=0;x<frame.w;x++){
                        const a=pixels[((frame.y+y)*image.width+frame.x+x)*4+3];
                        if(a>80){weight+=a;sumX+=(frame.x+x)*a;}
                    }
                    return {x:weight?sumX/weight:frame.x+frame.w/2,y:frame.y+12};
                }
                return {x:frame.x+12,y:total?sumY/total:frame.y+frame.h*.3};
            });
            atlas.span=Math.max(...atlas.frames.map((frame,i)=>frame.x+frame.w-(atlas.roots?.[i]?.x??frame.x)));
        }
    };
    image.src=atlas.url;
};
const paint=(ctx:CanvasRenderingContext2D,atlas:Atlas,index:number,x:number,y:number,w:number,h:number)=>{
    const frame=atlas.frames?.[index];if(!frame||!atlas.image)return;
    ctx.drawImage(atlas.image,frame.x,frame.y,frame.w,frame.h,Math.round(x),Math.round(y),Math.round(w),Math.round(h));
};
export interface ConvertibleLayers {body?:boolean;wheels?:boolean;people?:boolean;hair?:boolean;wheelStyle?:"animated"|"original"}
export const drawConvertible=(ctx:CanvasRenderingContext2D,cx:number,floor:number,width:number,
    steering:number,t:number,playing:boolean,layers:ConvertibleLayers={},travelDistance?:number)=>{
    load(body);load(people);load(hair);load(centerHair);load(wheelRotation);
    const column=steering<-.015?0:steering>.015?2:1;
    const frame=body.frames?.[column];if(!frame||!body.image)return false;
    const w=Math.round(width),h=Math.round(w*frame.h/frame.w);
    const bottom=Math.round(floor),left=Math.round(cx-w/2),top=bottom-h;
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(layers.body!==false||layers.wheels!==false){
        ctx.fillStyle="rgba(27,31,37,.4)";ctx.fillRect(Math.round(cx-w*.43),bottom-1,Math.round(w*.86),3);
    }
    // Rigid suspension motion carries every layer together; the shadow stays grounded.
    ctx.translate(0,suspensionOffset(w,t,playing));
    {
        const separated=body.layers?.[column];
        if(separated){
            const wheelFrame=rollingWheelFrame(travelDistance??t*(playing?12:3.2));
            if(layers.wheels!==false)ctx.drawImage(layers.wheelStyle==="original"?separated.originalWheels:separated.wheels[wheelFrame],0,0,frame.w,frame.h,left,top,w,h);
            if(layers.body!==false)ctx.drawImage(separated.body,0,0,frame.w,frame.h,left,top,w,h);
        }
    }
    // Characters sit behind the deck. Their image transforms never affect the car.
    const cabinBottom=bottom-h*.72;
    const personH=w*.23,personBottom=cabinBottom+w*.03;
    const driverX=cx+w*[-.15,-.17,-.19][column];
    const passengerX=cx+w*[.19,.17,.15][column];
    if(layers.people!==false){
        ctx.save();ctx.beginPath();ctx.rect(cx-w*.32,top-w*.18,w*.64,cabinBottom-(top-w*.18));ctx.clip();
        for(const [index,x] of [[column,driverX],[column+3,passengerX]]){
            const f=people.frames?.[index];if(!f)continue;
            const pw=personH*f.w/f.h;
            paint(ctx,people,index,x-pw/2,personBottom-personH,pw,personH);
        }
        ctx.restore();
        const hairAtlas=column===1?centerHair:hair;
        if(layers.hair!==false&&hairAtlas.frames){
            // A cyclic frame sequence moves only the isolated hair image.
            const cycle=[0,1,2,3,4,5,6,7];
            const index=cycle[Math.floor(t*(playing?9:4))%cycle.length];
            const f=hairAtlas.frames[index],root=hairAtlas.roots?.[index];
            if(root&&hairAtlas.image){
                // One scale for the whole sequence. Register the painted root,
                // never normalize each frame's height or move the layer sinusoidally.
                const scale=column===1?w*.14/Math.max(...hairAtlas.frames.map(frame=>frame.w)):w*.205/(hairAtlas.span??f.w);
                const rootX=passengerX+(column===1?0:column===2?w*.01:-w*.01);
                const rootY=personBottom-personH+w*(column===1?.008:.045);
                ctx.save();ctx.translate(Math.round(rootX),Math.round(rootY));
                if(column===2)ctx.scale(-1,1);
                const crown=column===1?{x:-w*.035,y:-w*.015,w:w*.07,h:w*.055}:{x:-w*.025,y:-w*.05,w:w*.06,h:w*.1};
                ctx.save();ctx.beginPath();ctx.rect(-w,-w,w*2,w*2);
                ctx.rect(crown.x,crown.y,crown.w,crown.h);ctx.clip("evenodd");
                ctx.drawImage(hairAtlas.image,f.x,f.y,f.w,f.h,
                    Math.round(-(root.x-f.x)*scale),Math.round(-(root.y-f.y)*scale),
                    Math.round(f.w*scale),Math.round(f.h*scale));
                ctx.restore();
                // Keep the attached crown pixel-identical; only free locks animate.
                const fixed=hairAtlas.frames[0],fixedRoot=hairAtlas.roots?.[0];
                if(fixedRoot){
                    ctx.save();ctx.beginPath();ctx.rect(crown.x,crown.y,crown.w,crown.h);ctx.clip();
                    ctx.drawImage(hairAtlas.image,fixed.x,fixed.y,fixed.w,fixed.h,
                        Math.round(-(fixedRoot.x-fixed.x)*scale),Math.round(-(fixedRoot.y-fixed.y)*scale),
                        Math.round(fixed.w*scale),Math.round(fixed.h*scale));
                    ctx.restore();
                }
                ctx.restore();
            }
        }
    }
    ctx.restore();return true;
};
