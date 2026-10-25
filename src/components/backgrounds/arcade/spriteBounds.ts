export interface SpriteRect {x:number;y:number;w:number;h:number}
export const findSpriteBounds = (pixels:Uint8ClampedArray,imageWidth:number,cell:SpriteRect,mainOnly=false):SpriteRect => {
    const {x:cx,y:cy,w:cw,h:ch}=cell;
    const opaque=(x:number,y:number)=>pixels[((cy+y)*imageWidth+cx+x)*4+3]>40;
    let minX=cw,minY=ch,maxX=-1,maxY=-1;
    if(mainOnly){
        const visited=new Uint8Array(cw*ch),queue=new Int32Array(cw*ch);
        let largest=0;
        for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
            const start=y*cw+x;if(visited[start]||!opaque(x,y))continue;
            let read=0,write=1,l=x,r=x,t=y,b=y;queue[0]=start;visited[start]=1;
            while(read<write){
                const n=queue[read++],px=n%cw,py=Math.floor(n/cw);
                l=Math.min(l,px);r=Math.max(r,px);t=Math.min(t,py);b=Math.max(b,py);
                for(const next of [px>0?n-1:-1,px<cw-1?n+1:-1,py>0?n-cw:-1,py<ch-1?n+cw:-1]){
                    if(next<0||visited[next])continue;
                    visited[next]=1;
                    if(opaque(next%cw,Math.floor(next/cw)))queue[write++]=next;
                }
            }
            if(write>largest){largest=write;minX=l;maxX=r;minY=t;maxY=b;}
        }
    }else{
        for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(opaque(x,y)){
            minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
        }
    }
    return maxX<minX?cell:{x:cx+minX,y:cy+minY,w:maxX-minX+1,h:maxY-minY+1};
};
