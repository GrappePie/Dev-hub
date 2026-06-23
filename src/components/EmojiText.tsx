import { useMemo, useState } from "react";
// @ts-ignore — twemoji has no bundled types
import twemoji from "twemoji";

interface EmojiTextProps {
    text: string;
    /** Rendered size in CSS px (default 14) */
    size?: number;
}

// Attempt to serve pixel-art emoji from /public/emoji/pixel/{codepoint}.png first.
// On error, fall back to the twemoji CDN image.
const PixelEmoji = ({ src, alt, size }: { src: string; alt: string; size: number }) => {
    // Extract the codepoint filename from the twemoji CDN URL (e.g. "1f600.png")
    const filename = src.split("/").pop() ?? "";
    const [imgSrc, setImgSrc] = useState(`/emoji/pixel/${filename}`);

    return (
        <img
            src={imgSrc}
            alt={alt}
            onError={() => {
                if (imgSrc !== src) setImgSrc(src); // fall back to twemoji CDN once
            }}
            draggable={false}
            style={{
                width: size,
                height: size,
                display: "inline-block",
                verticalAlign: "middle",
                imageRendering: "pixelated",
                margin: "0 1px",
            }}
        />
    );
};

// Regex that matches a single <img … /> tag produced by twemoji.parse()
const IMG_RE = /<img[^>]+class="emoji"[^>]+src="([^"]+)"[^>]+alt="([^"]+)"[^>]*\/?>/g;

function htmlToNodes(html: string, size: number): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    IMG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = IMG_RE.exec(html)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(html.slice(lastIndex, match.index));
        }
        const [, src, alt] = match;
        nodes.push(<PixelEmoji key={match.index} src={src} alt={alt} size={size} />);
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < html.length) nodes.push(html.slice(lastIndex));
    return nodes;
}

/**
 * Renders text with emojis replaced by pixel-art images.
 * - First tries /public/emoji/pixel/{codepoint}.png (drop any PNG there to override).
 * - Falls back to the official Twemoji CDN for full coverage.
 */
const EmojiText = ({ text, size = 14 }: EmojiTextProps) => {
    const nodes = useMemo(() => {
        const html: string = twemoji.parse(text, {
            folder: "72x72",
            ext: ".png",
            base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
        });
        return htmlToNodes(html, size);
    }, [text, size]);

    return <>{nodes}</>;
};

export default EmojiText;
