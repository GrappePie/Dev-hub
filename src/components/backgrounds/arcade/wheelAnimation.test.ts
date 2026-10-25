import {describe,it,expect} from "vitest";
import {balancedWheelFrames} from "./wheelAnimation";
describe("balanced isolated wheel",()=>{
    it("keeps identical circular coverage and axle in every rotating cel",()=>{
        const w=100,source=new Uint8ClampedArray(w*w*4);
        for(let y=0;y<w;y++)for(let x=0;x<w;x++){
            if(Math.hypot(x-48,y-51)>46)continue;
            const p=(y*w+x)*4;source.set([x*2,y*2,100,255],p);
        }
        const original=new Uint8ClampedArray(source);
        const frames=balancedWheelFrames(source,w,w,80);
        const alpha=(frame:Uint8ClampedArray)=>frame.filter((_,i)=>i%4===3);
        const coverage=alpha(frames[0]);
        for(const frame of frames){
            expect(alpha(frame)).toEqual(coverage);
            let symmetric=true;
            for(let y=0;y<80;y++)for(let x=0;x<80;x++){
                if(frame[(y*80+x)*4+3]!==frame[((79-y)*80+79-x)*4+3])symmetric=false;
            }
            expect(symmetric).toBe(true);
        }
        expect(frames[1]).not.toEqual(frames[0]);
        expect(source).toEqual(original);
    });
});
