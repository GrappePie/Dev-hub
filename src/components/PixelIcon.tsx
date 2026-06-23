import type { CSSProperties, SVGProps } from "react";
import { cn } from "@/lib/utils";

export type PixelIconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element;

const SIZE_CLASS = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-7 h-7",
    xl: "w-9 h-9",
} as const;

interface PixelIconProps {
    icon: PixelIconComponent;
    size?: keyof typeof SIZE_CLASS;
    className?: string;
    title?: string;
}

const pixelStyle: CSSProperties = {
    imageRendering: "pixelated",
    shapeRendering: "crispEdges",
};

const PixelIcon = ({ icon: Icon, size = "sm", className, title }: PixelIconProps) => (
    <Icon
        aria-hidden={title ? undefined : true}
        aria-label={title}
        className={cn("shrink-0 align-middle", SIZE_CLASS[size], className)}
        style={pixelStyle}
    />
);

export default PixelIcon;
