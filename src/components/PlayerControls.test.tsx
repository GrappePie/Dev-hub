import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlayerControls from "./PlayerControls";

vi.mock("@/hooks/useRetroSfx", () => ({
    default: () => vi.fn(),
}));

const defaultProps = {
    isPlaying: false,
    shuffleMode: "off" as const,
    repeatMode: 0,
    progress: 25,
    volume: 0.5,
    currentTime: "0:10",
    totalTime: "3:00",
    onPlayPause: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onShuffleCycle: vi.fn(),
    onRepeatToggle: vi.fn(),
    onProgressChange: vi.fn(),
    onVolumeChange: vi.fn(),
};

describe("PlayerControls", () => {
    it("shows smart shuffle as an energized power field instead of the overdrive animation", () => {
        render(<PlayerControls {...defaultProps} shuffleMode="smart" />);

        const shuffleButton = screen.getByRole("button", { name: /smart shuffle activado/i });

        expect(shuffleButton).toHaveClass("smart-shuffle-power-field");
        expect(shuffleButton).not.toHaveClass("smart-shuffle-overdrive");
        expect(shuffleButton).not.toHaveTextContent("★");
    });

    it("does not vibrate the smart shuffle button", () => {
        render(<PlayerControls {...defaultProps} shuffleMode="smart" />);

        const shuffleButton = screen.getByRole("button", { name: /smart shuffle activado/i });

        expect(shuffleButton).not.toHaveClass("smart-shuffle-vibrate");
    });

    it("does not render particles or trail marks for smart shuffle", () => {
        render(<PlayerControls {...defaultProps} shuffleMode="smart" />);

        const shuffleButton = screen.getByRole("button", { name: /smart shuffle activado/i });

        expect(shuffleButton.querySelector(".smart-shuffle-particle-field")).toBeNull();
        expect(shuffleButton.querySelector(".smart-shuffle-particle")).toBeNull();
        expect(shuffleButton.querySelector(".smart-shuffle-trail-mark")).toBeNull();
        expect(shuffleButton.querySelector(".smart-shuffle-spark")).toBeNull();
    });

    it("keeps the regular shuffle icon still outside smart mode", () => {
        render(<PlayerControls {...defaultProps} shuffleMode="shuffle" />);

        const shuffleButton = screen.getByRole("button", { name: /shuffle activado/i });

        expect(shuffleButton.querySelector(".smart-shuffle-core")).toBeNull();
        expect(shuffleButton).not.toHaveClass("smart-shuffle-power-field");
    });
});
