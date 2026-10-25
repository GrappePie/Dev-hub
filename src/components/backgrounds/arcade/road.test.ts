import {describe,expect,it} from "vitest";
import {buildRoad} from "./road";
describe("procedural road relief",()=>{
    it("creates crests that occlude distant traffic, not just a moving horizon",()=>{
        let occluded=0;
        for(let distance=0;distance<1560;distance+=13){
            const route=buildRoad(480,270,distance,0,{x:0,y:0});
            for(const point of route.points){
                expect(Number.isFinite(point.x+point.y+point.half)).toBe(true);
                if(point.z>8 && point.y>route.clipAt(point.z)+2)occluded++;
            }
        }
        expect(occluded).toBeGreaterThan(100);
    });
    it("retains a stable road contact point below the player while turning",()=>{
        for(const [w,h] of [[480,270],[195,350]]){
            for(let distance=0;distance<1560;distance+=17){
                const route=buildRoad(w,h,distance,1,{x:0,y:0});
                const player=route.project(route.playerZ);
                expect(player.y/h).toBeGreaterThan(.9);
                expect(player.y/h).toBeLessThan(.99);
                expect(route.bands.length).toBeGreaterThan(10);
            }
        }
    });
});
