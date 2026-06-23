import { ReactNode } from "react";

interface PixelBubbleProps {
    children: ReactNode;
}

const PX = 4;      // 1 "pixel" = 4 CSS px
const BORDER = PX; // border thickness

// 20-point polygon: 2-step right-angle staircase on the ink border div.
const INK_CLIP = [
    `8px 0`,   `calc(100% - 8px) 0`,
    // top-right staircase
    `calc(100% - 8px) 4px`, `calc(100% - 4px) 4px`, `calc(100% - 4px) 8px`,
    `100% 8px`, `100% calc(100% - 8px)`,
    // bottom-right staircase
    `calc(100% - 4px) calc(100% - 8px)`, `calc(100% - 4px) calc(100% - 4px)`, `calc(100% - 8px) calc(100% - 4px)`,
    `calc(100% - 8px) 100%`,
    `8px 100%`,
    // bottom-left staircase
    `8px calc(100% - 4px)`, `4px calc(100% - 4px)`, `4px calc(100% - 8px)`,
    `0 calc(100% - 8px)`, `0 8px`,
    // top-left staircase
    `4px 8px`, `4px 4px`, `8px 4px`,
].join(", ");

// 12-point polygon: 1-step staircase on the fill div (inner white area).
// Where the fill is clipped, the ink border behind it shows through —
// giving the white fill the same staircase rounded look as the ink outline.
const FILL_CLIP = [
    `4px 0`, `calc(100% - 4px) 0`,
    // top-right 1-step
    `calc(100% - 4px) 4px`, `100% 4px`,
    `100% calc(100% - 4px)`,
    // bottom-right 1-step
    `calc(100% - 4px) calc(100% - 4px)`, `calc(100% - 4px) 100%`,
    `4px 100%`,
    // bottom-left 1-step
    `4px calc(100% - 4px)`, `0 calc(100% - 4px)`,
    `0 4px`,
    // top-left 1-step
    `4px 4px`,
].join(", ");

/**
 * Pixel-art speech bubble:
 * - Ink border via an absolute div with right-angle staircase clip-path.
 *   Corners are truly transparent — no background-color matching needed.
 * - display:flow-root on wrapper creates a BFC so the fill div's margin
 *   never collapses, keeping all 4 borders visible at any height.
 * - Stair-stepped tail at bottom-left.
 */
const PixelBubble = ({ children }: PixelBubbleProps) => {
    const ink  = "hsl(var(--pixel-ink))";
    const fill = "hsl(var(--pixel-bubble))";

    return (
        <div className="relative w-full font-display text-[11px]">
            {/* display:flow-root = Block Formatting Context → fill margin never collapses */}
            <div style={{ display: "flow-root" }}>
                {/* Ink border: absolute, same size as wrapper, clipped to staircase polygon */}
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: ink,
                        clipPath: `polygon(${INK_CLIP})`,
                    }}
                />
                {/* Fill: margin:BORDER insets it inside the ink border.
                    clipPath clips the white fill's own corners so the ink
                    shows through at each corner, completing the staircase. */}
                <div
                    className="relative"
                    style={{
                        background: fill,
                        color: ink,
                        margin: BORDER,
                        padding: `${PX * 3}px ${PX * 4}px`,
                        zIndex: 1,
                        clipPath: `polygon(${FILL_CLIP})`,
                    }}
                >
                    {children}
                </div>
            </div>

            {/* ── Stair-stepped tail at bottom-left ──
                Overlaps bottom ink border by BORDER px so fill connects flush. */}
            <div
                aria-hidden
                className="absolute"
                style={{
                    left: PX * 6,
                    top: `calc(100% - ${BORDER + 1}px)`,
                    width: PX * 6,
                    height: PX * 5,
                }}
            >
                <Px x={0} y={0} w={5} color={fill} />
                <Px x={5} y={0} color={ink} />
                <Px x={0} y={1} color={ink} />
                <Px x={1} y={1} w={3} color={fill} />
                <Px x={4} y={1} color={ink} />
                <Px x={0} y={2} color={ink} />
                <Px x={1} y={2} w={2} color={fill} />
                <Px x={3} y={2} color={ink} />
                <Px x={0} y={3} color={ink} />
                <Px x={1} y={3} color={fill} />
                <Px x={2} y={3} color={ink} />
                <Px x={0} y={4} color={ink} />
                <Px x={1} y={4} color={ink} />
            </div>
        </div>
    );
};

const Px = ({
    x, y,
    w = 1, h = 1,
    color,
}: {
    x: number; y: number;
    w?: number; h?: number;
    color: string;
}) => (
    <span
        className="absolute"
        style={{
            left:   x * PX,
            top:    y * PX,
            width:  w * PX,
            height: h * PX,
            background: color,
        }}
    />
);

export default PixelBubble;
