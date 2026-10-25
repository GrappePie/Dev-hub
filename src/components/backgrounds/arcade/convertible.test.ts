import {afterEach,describe,expect,it,vi} from "vitest";
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("independent convertible layers",()=>{
    it("changes only the hair frame while the car and both characters keep their transforms",async()=>{
        vi.resetModules();
        class LoadedImage {
            width=300;height=200;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
            set src(_value:string){this.onload?.();}
        }
        vi.stubGlobal("Image",LoadedImage);
        const loader={drawImage:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray(300*200*4)})};
        vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(loader as unknown as CanvasRenderingContext2D);
        const ctx={drawImage:vi.fn(),save:vi.fn(),restore:vi.fn(),translate:vi.fn(),scale:vi.fn(),beginPath:vi.fn(),rect:vi.fn(),clip:vi.fn(),fillRect:vi.fn()};
        const {drawConvertible}=await import("./convertible");
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,0,true);
        const first=ctx.drawImage.mock.calls.map(args=>[...args]);
        const anchor=[...ctx.translate.mock.calls[0]];
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,.25,true);
        const second=ctx.drawImage.mock.calls;
        expect(first).toHaveLength(5);
        expect(second[0]).toEqual(first[0]); // car, including source pixels
        expect(second[1]).toEqual(first[1]); // driver
        expect(second[2]).toEqual(first[2]); // passenger
        expect(second[3][0]).toBe(first[3][0]);
        expect(second[3].slice(5)).toEqual(first[3].slice(5)); // fixed root/placement and scale
        expect(second[3][1]).not.toBe(first[3][1]); // independent hair animation frame
        expect(second[4]).toEqual(first[4]); // attached crown is pixel-identical
        for(let frame=0;frame<8;frame++){
            ctx.drawImage.mockClear();ctx.translate.mockClear();
            drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,0,(frame+.1)/9,true);
            expect(ctx.drawImage.mock.calls[0]).toEqual(first[0]);
            expect(ctx.drawImage.mock.calls[4]).toEqual(first[4]);
            expect(ctx.translate.mock.calls[0]).toEqual(anchor);
        }
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,-.08,0,true);
        const sideImage=ctx.drawImage.mock.calls[3][0];
        expect(sideImage).not.toBe(first[3][0]); // distinct rear-view atlas
        ctx.drawImage.mockClear();
        drawConvertible(ctx as unknown as CanvasRenderingContext2D,200,280,150,.08,0,true);
        expect(ctx.drawImage.mock.calls[3][0]).toBe(sideImage);
        expect(ctx.scale).toHaveBeenCalledWith(-1,1);
    });
});
