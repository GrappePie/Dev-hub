import {describe,it,expect} from "vitest";
import {buildRoad} from "./road";
import {coastalEdges,laneHeading,turnDustStrength} from "./roadDetails";
describe("coast and driver presentation",()=>{
    it("keeps palm roots between the dry shoreline and the left asphalt edge",()=>{
        for(const [w,h] of [[480,270],[195,350]])for(let d=0;d<1560;d+=31){
            const route=buildRoad(w,h,d,0,{x:0,y:0});
            for(const z of [2,4,8,16,32,64,100]){
                const p=route.project(z),edges=coastalEdges(p,d+z,h*.055/z);
                expect(edges.palm).toBeGreaterThan(edges.shore);
                expect(edges.palm).toBeLessThan(p.x-p.half);
                expect(edges.shallow).toBeLessThan(edges.shore);
            }
        }
    });
    it("returns to a straight pose after the lane change ends, following road direction",()=>{
        const p={z:2,x:100,y:180,half:140,depth:1};
        expect(laneHeading(p,{...p,z:3,x:100,y:140},0)).toBe(0);
        expect(laneHeading(p,{...p,z:3,x:100,y:140},.002)).toBe(0);
        expect(laneHeading(p,{...p,z:3,x:120,y:140},0)).toBeGreaterThan(0);
        expect(laneHeading(p,{...p,z:3,x:80,y:140},0)).toBeLessThan(0);
    });
    it("emits dust on tight bends only during playback",()=>{
        expect(turnDustStrength(35,false)).toBe(0);
        expect(Math.abs(turnDustStrength(35,true))).toBeGreaterThan(.2);
    });
    it("keeps an outside-lane pose after lateral movement stops",()=>{
        const near={z:2,x:100,y:180,half:140,depth:1};
        const ahead={...near,z:3,y:140,half:80};
        expect(laneHeading(near,ahead,0,-1)).toBeGreaterThan(.015);
        expect(laneHeading(near,ahead,0,1)).toBeLessThan(-.015);
        expect(laneHeading(near,ahead,0,0)).toBe(0);
    });
});
