import {describe,it,expect} from "vitest";
import {findSpriteBounds} from "./spriteBounds";
describe("generated atlas crops",()=>{
    it("excludes neighboring leaf fragments while retaining the full main object",()=>{
        const data=new Uint8ClampedArray(12*10*4);
        for(let y=2;y<8;y++)for(let x=3;x<9;x++)data[(y*12+x)*4+3]=255;
        data[(0*12+11)*4+3]=255;
        expect(findSpriteBounds(data,12,{x:0,y:0,w:12,h:10},true)).toEqual({x:3,y:2,w:6,h:6});
    });
    it("keeps separate cloud puffs and ignores a faint alpha halo when cleanup is disabled",()=>{
        const data=new Uint8ClampedArray(12*10*4);
        data[(3*12+2)*4+3]=255;data[(7*12+9)*4+3]=255;data[3]=20;
        expect(findSpriteBounds(data,12,{x:0,y:0,w:12,h:10})).toEqual({x:2,y:3,w:8,h:5});
    });
});
