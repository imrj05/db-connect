import { renderHook, waitFor } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

describe("useIsMobile", () => {
  it("should report true when the viewport is below the mobile breakpoint", async () => {
    Object.defineProperty(window, "innerWidth", { value: 767, writable: true });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should report false when the viewport is at or above the breakpoint", async () => {
    Object.defineProperty(window, "innerWidth", { value: 768, writable: true });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
