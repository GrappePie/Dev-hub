import { findSpriteBounds } from "./spriteBounds";
import natureUrl from "@/assets/arcade-nature-generated-v1.png";
import trafficUrl from "@/assets/arcade-traffic-generated-v1.png";
import sceneryUrl from "@/assets/arcade-scenery-generated-v1.png";
import waterUrl from "@/assets/arcade-water-generated-v1.png";

type SetName = "nature" | "traffic" | "scenery" | "water";
interface Frame { x: number; y: number; w: number; h: number }
interface Atlas { url: string; columns: number; rows: number; opaque?: boolean; clean?: boolean; cuts?: number[][]; image?: HTMLImageElement; frames?: Frame[]; failed?: boolean }
const atlases: Record<SetName, Atlas> = {
    nature: {url:natureUrl,columns:4,rows:2,clean:true,cuts:[[0,0,405,600],[405,0,385,600],[790,0,450,600],[1240,0,296,600],[0,600,398,424],[398,600,392,424],[790,600,334,424],[1124,600,412,424]]},
    traffic: {url:trafficUrl,columns:3,rows:2,cuts:[[0,0,512,480],[512,0,512,480],[1024,0,512,480],[0,480,530,544],[530,480,494,544],[1024,480,512,544]]},
    scenery: {url:sceneryUrl,columns:3,rows:2,cuts:[[0,0,512,600],[512,0,512,600],[1024,0,512,600],[0,600,512,424],[512,600,512,424],[1024,600,512,424]]},
    water: {url:waterUrl,columns:2,rows:2,opaque:true},
};
const load = (atlas: Atlas) => {
    if(atlas.image || atlas.failed) return;
    const image = new Image();atlas.image=image;
    image.onerror=()=>{atlas.failed=true;};
    image.onload=()=>{
        const cellW=Math.floor(image.width/atlas.columns),cellH=Math.floor(image.height/atlas.rows);
        const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext("2d");if(!ctx){atlas.failed=true;return;}
        ctx.drawImage(image,0,0);
        const pixels=atlas.opaque?null:ctx.getImageData(0,0,image.width,image.height).data;
        atlas.frames=Array.from({length:atlas.columns*atlas.rows},(_,i)=>{
            const [cx,cy,cw,ch]=atlas.cuts?.[i]??[i%atlas.columns*cellW,Math.floor(i/atlas.columns)*cellH,cellW,cellH];
            if(!pixels)return {x:cx,y:cy,w:cw,h:ch};
            return findSpriteBounds(pixels,image.width,{x:cx,y:cy,w:cw,h:ch},atlas.clean);

        });
    };
    image.src=atlas.url;
};
export const warmArcadeArt = () => Object.values(atlases).forEach(load);
export const drawArt = (
    ctx:CanvasRenderingContext2D,set:SetName,index:number,cx:number,bottom:number,
    size:{height:number;width?:number;wind?:number;flip?:boolean;anchorX?:number},
) => {
    const atlas=atlases[set];load(atlas);
    const frame=atlas.frames?.[index];if(!frame || !atlas.image)return false;
    const h=Math.max(1,Math.round(size.height));
    const w=Math.max(1,Math.round(size.width??h*frame.w/frame.h));
    const left=-Math.round(w*(size.anchorX??.5));
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.translate(Math.round(cx),Math.round(bottom));if(size.flip)ctx.scale(-1,1);
    if(size.wind && h>12){
        // Sway only the crown. The trunk's contact with the ground stays fixed.
        for(let band=0;band<8;band++){
            const sy=frame.y+frame.h*band/8,sh=frame.h/8;
            const offset=Math.round(size.wind*Math.max(0,1-band/3)*Math.min(2,h*.018));
            ctx.drawImage(atlas.image,frame.x,sy,frame.w,sh,left+offset,-h+Math.round(h*band/8),w,Math.ceil(h/8));
        }
    }else ctx.drawImage(atlas.image,frame.x,frame.y,frame.w,frame.h,left,-h,w,h);
    ctx.restore();return true;
};
const oceans=new WeakMap<CanvasRenderingContext2D,{canvas:HTMLCanvasElement;tick:number}>();
export const drawOcean = (ctx:CanvasRenderingContext2D,w:number,h:number,t:number) => {
    const atlas=atlases.water;load(atlas);
    const frame=atlas.frames?.[Math.floor(t*5)%4];if(!frame||!atlas.image)return false;
    let cached=oceans.get(ctx);
    if(!cached){cached={canvas:document.createElement("canvas"),tick:-1};oceans.set(ctx,cached);}
    const tick=Math.floor(t*5);
    if(cached.canvas.width!==w||cached.canvas.height!==h||cached.tick!==tick){
        cached.canvas.width=w;cached.canvas.height=h;cached.tick=tick;
        const c=cached.canvas.getContext("2d");if(!c)return false;c.imageSmoothingEnabled=false;
        const tileW=Math.max(48,Math.round(w*.65)),tileH=Math.max(16,Math.round(tileW*.28));
        const drift=Math.floor(t*3)%tileW;
        for(let y=-tileH;y<h;y+=tileH)for(let x=-tileW;x<w+tileW;x+=tileW)
            c.drawImage(atlas.image,frame.x,frame.y,frame.w,frame.h,x+drift,y,tileW,tileH);
    }
    ctx.drawImage(cached.canvas,0,0);return true;
};
