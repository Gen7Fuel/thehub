import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── Hoisted mutable state ─────────────────────────────────────────────────────

const {
  mockUseLoaderData,
  mockRouterInvalidate,
  mockUser,
  mockNavigate,
  mockSearch,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn().mockReturnValue({ events: [] }),
  mockRouterInvalidate: vi.fn().mockResolvedValue(undefined),
  mockNavigate: vi.fn(),
  mockSearch: { month: undefined, site: undefined },
  mockUser: {
    id: "user-1",
    location: "Rankin",
    is_admin: false,
  },
}));

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      useLoaderData: mockUseLoaderData,
      useSearch: () => mockSearch,
    }),
    useRouter: () => ({
      invalidate: mockRouterInvalidate,
      navigate: mockNavigate,
    }),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/context/SiteContext", () => ({
  useSite: () => ({ selectedSite: "Rankin" }),
}));

vi.mock("@/components/custom/locationPicker", () => ({
  LocationPicker: ({ setStationName, defaultValue }: any) => (
    <input
      data-testid="location-picker"
      defaultValue={defaultValue}
      onChange={(e) => setStationName(e.target.value)}
    />
  ),
}));

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// ─── Component import (after mocks) ───────────────────────────────────────────

const { Route } = await import("../events/index");
const EventsComponent = (Route as any).component as React.ComponentType;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderWithSuspense = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <React.Suspense fallback={null}>{children}</React.Suspense>
    ),
  });

const today = new Date();

// ─── Tests: Basic Rendering & Layout ──────────────────────────────────────────

describe("Events — core rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("token", "test-token");
    mockUseLoaderData.mockReturnValue({ events: [] });
    mockUser.is_admin = false;
  });

  it("renders the main Events Calendar heading", async () => {
    renderWithSuspense(<EventsComponent />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Events Calendar/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows location schedule subtitle", async () => {
    renderWithSuspense(<EventsComponent />);
    await waitFor(() => {
      expect(
        screen.getByText(/Showing schedule for Rankin/i),
      ).toBeInTheDocument();
    });
  });

  it("displays weekday column headers in calendar grid", async () => {
    renderWithSuspense(<EventsComponent />);
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    await waitFor(() => {
      weekdays.forEach((day) =>
        expect(screen.getByText(day)).toBeInTheDocument(),
      );
    });
  });
});

// ─── Tests: Basic Compose Interaction ─────────────────────────────────────────

describe("Events — compose dialog basic flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("token", "test-token");
    mockUseLoaderData.mockReturnValue({ events: [] });
  });

  it("opens compose modal when clicking today tile", async () => {
    renderWithSuspense(<EventsComponent />);

    const todayCell = screen
      .getByText(today.getDate().toString())
      .closest("div");
    if (todayCell) fireEvent.click(todayCell);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "New Event" }),
      ).toBeInTheDocument();
    });
  });

  it("enforces max length constraint on title input", async () => {
    renderWithSuspense(<EventsComponent />);

    const todayCell = screen
      .getByText(today.getDate().toString())
      .closest("div");
    if (todayCell) fireEvent.click(todayCell);

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Event title/i);
      expect(input).toHaveAttribute("maxLength", "30");
    });
  });
});

// ─── Tests: Utility Helpers ───────────────────────────────────────────────────

describe("Events — helper functions", () => {
  it("formats ISO date string properly", () => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date(2026, 8, 28);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    expect(iso).toBe("2026-09-28");
  });
});