import {describe,it,expect} from "vitest";
import {perspectiveWheelFrames,wheelViews} from "./wheelPerspective";
describe("perspective wheel rotation",()=>{
    it("rotates both visible surfaces without moving the axle, bounds or contact patch",()=>{
        const size=48,pixels=new Uint8ClampedArray(size*size*4);
        for(let y=0;y<size;y++)for(let x=0;x<size;x++)pixels.set([x*5,y*5,(x+y)%2*150,255],(y*size+x)*4);
        const texture={pixels,width:size,height:size};
        for(const yaw of wheelViews){
            const frames=perspectiveWheelFrames(texture,texture,yaw,size);
            expect(frames).toHaveLength(8);
            const alpha=frames[0].filter((_,i)=>i%4===3);
            for(const frame of frames)expect(frame.filter((_,i)=>i%4===3)).toEqual(alpha);
            // Includes edge-on views: the tread must move even without a visible rim.
            expect(frames[1]).not.toEqual(frames[0]);
            let symmetric=true;
            for(let y=0;y<size;y++)for(let x=0;x<size;x++){
                if(alpha[y*size+x]!==alpha[(size-1-y)*size+size-1-x])symmetric=false;
            }
            expect(symmetric).toBe(true);
        }
    });
});
