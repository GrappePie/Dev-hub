import {describe,expect,it} from "vitest";
import {rollingWheelFrame,suspensionOffset} from "./convertibleMotion";
import {splitConvertiblePixels} from "./convertibleLayers";
describe("convertible motion",()=>{
    it("rolls in proportion to travel, including slow coasting and a genuine stop",()=>{
        expect(rollingWheelFrame(0)).toBe(0);
        expect(rollingWheelFrame(1)).toBe(1);
        expect(rollingWheelFrame(2)).toBe(3);
        // Equal elapsed time: music pause still advances the coasting distance.
        expect(rollingWheelFrame(.25*3.2)).toBe(1);
        expect(rollingWheelFrame(.25*12)).toBe(4);
        expect(rollingWheelFrame(8/1.5)).toBe(0);
    });
    it("keeps suspension bounded and still when playback stops",()=>{
        const offsets=Array.from({length:100},(_,i)=>suspensionOffset(440,i/30,true));
        expect(Math.max(...offsets)).toBeGreaterThan(2);
        expect(Math.min(...offsets)).toBeLessThan(-2);
        expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(5);
        expect(suspensionOffset(440,.2,false)).toBe(0);
    });
    it("separates wheels losslessly and keeps their animation out of the body",()=>{
        const w=100,h=80,source=new Uint8ClampedArray(w*h*4);
        for(let i=0;i<w*h;i++)source.set([i%90,i%90,i%90,255],i*4);
        const original=new Uint8ClampedArray(source);
        for(let column=0;column<3;column++){
            const {body,wheels}=splitConvertiblePixels(source,w,{x:0,y:0,w,h},column);
            for(let i=0;i<w*h;i++){
                const offset=i*4;
                expect(body[offset+3]+wheels[offset+3]).toBe(255);
                if(body[offset+3])expect(wheels[offset+3]).toBe(0);
                const layer=body[offset+3]?body:wheels;
                expect(layer.slice(offset,offset+4)).toEqual(source.slice(offset,offset+4));
            }
        }
        expect(source).toEqual(original);
    });
    it("keeps the rear exhausts in the static body instead of the far-wheel mask",()=>{
        const source=new Uint8ClampedArray(100*100*4);
        for(let p=0;p<source.length;p+=4)source.set([150,150,150,255],p);
        for(const [column,x] of [[0,84],[2,16]]){
            const {body,wheels}=splitConvertiblePixels(source,100,{x:0,y:0,w:100,h:100},column);
            const p=(86*100+x)*4;
            expect(body[p+3]).toBe(255);expect(wheels[p+3]).toBe(0);
        }
    });
    it("gives the rear wheel priority where it occludes the front wheel in either side view",()=>{
        const source=new Uint8ClampedArray(200*200*4);
        for(let p=0;p<source.length;p+=4)source.set([70,70,70,255],p);
        for(const [column,x] of [[0,17],[2,183]]){
            const {owners}=splitConvertiblePixels(source,200,{x:0,y:0,w:200,h:200},column);
            expect(owners[150*200+x]).toBe(2);
        }
    });
});
