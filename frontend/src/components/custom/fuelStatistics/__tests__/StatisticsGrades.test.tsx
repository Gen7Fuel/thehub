import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { Route } from "@/routes/_navbarLayout/fuel-management/statistics";

const { inventoryCoverage } = vi.hoisted(() => ({ inventoryCoverage: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  createFileRoute: () => (options: object) => ({ options }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/api/fuel-management/fuel-grades.service", () => ({
  fuelGradeOptionsQuery: {
    queryKey: ["fuel-grades", "options"],
    queryFn: async () => [
      { key: "Regular", name: "Regular", shortName: "RUL", color: "#067647", active: true },
      { key: "E15", name: "E15", shortName: "E15", color: "#7146b0", active: true },
      { key: "Dyed Premium", name: "Dyed Premium", shortName: "PULD", color: "#c6395c", active: false },
      { key: "Old Grade", name: "Old Grade", shortName: "OLD", color: "#475569", active: false },
    ],
  },
}));

vi.mock("@/api/fuel-management/fuel-station-tanks.service", () => ({
  fuelStationTanksService: {
    listLocations: async () => [{ _id: "station-1", stationName: "Rankin", tankCount: 1 }],
    syncAllVolumes: async () => [{
      _id: "tank-1", stationId: "station-1", grade: "Regular", currentVolume: 10000, tankCapacity: 25000,
      maxVolumeCapacity: 23750, minVolumeCapacity: 5000, lastUpdatedVolumeReadingDateTime: "2026-04-01 08:00",
    }],
  },
}));

vi.mock("@/api/fuel-management/fuel-statistics.service", () => ({
  fuelStatisticsService: {
    pipelineSummary: async () => ({
      data: [
        {
          _id: "order-1", currentStatus: "Delivered",
          items: [{ grade: "Regular", ltrs: 1000 }, { grade: "E15", ltrs: 1500 }, { grade: "Dyed Premium", ltrs: 500 }],
        },
        {
          _id: "order-2", currentStatus: "Delivered",
          items: [{ grade: "Regular", ltrs: 1000 }, { grade: "E15", ltrs: 0 }],
        },
      ],
    }),
    salesSummary: async () => ({ data: [] }),
    inventoryCoverage,
  },
}));

vi.mock("recharts", async (importOriginal) => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  BarChart: ({ children }: { children: ReactNode }) => children,
  Bar: ({ name, fill, stackId }: { name: string; fill: string; stackId?: string }) =>
    stackId === "pipeline" ? <span data-testid="pipeline-grade" style={{ color: fill }}>{name}</span> : null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Legend: () => null,
  Tooltip: () => null,
  PieChart: () => null,
  LineChart: () => null,
}));

it("uses catalog labels and colors while keeping order grades separate from shared tank inventory", async () => {
  inventoryCoverage.mockResolvedValue({ data: { byGrade: {}, forecastDays: [] } });
  const Statistics = Route.options.component!;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Statistics /></QueryClientProvider>);

  const regularFilter = await screen.findByRole("button", { name: "RUL", pressed: true });
  expect(regularFilter).toHaveStyle({ backgroundColor: "#067647" });
  const e15Filter = screen.getByRole("button", { name: "E15", pressed: true });
  expect(e15Filter).toHaveStyle({ backgroundColor: "#7146b0" });
  expect(await screen.findByRole("button", { name: "PULD", pressed: true })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "OLD" })).not.toBeInTheDocument();

  const pipeline = screen.getByRole("heading", { name: "Volume Pipeline" }).parentElement!.parentElement!.parentElement!;
  expect(within(pipeline).getAllByTestId("pipeline-grade").map(series => series.textContent)).toEqual(["RUL", "E15", "PULD"]);
  expect(within(pipeline).getByText("4.0k L")).toBeInTheDocument();

  fireEvent.click(regularFilter);
  fireEvent.click(screen.getByRole("button", { name: "PULD", pressed: true }));
  expect(within(pipeline).getAllByTestId("pipeline-grade").map(series => series.textContent)).toEqual(["E15"]);
  expect(within(pipeline).getByText("1.5k L")).toBeInTheDocument();
  expect(within(pipeline).getByText("E15")).toHaveStyle({ color: "#7146b0" });

  expect(await screen.findAllByText("RUL | E15")).not.toHaveLength(0);
  for (const label of screen.getAllByText("RUL | E15")) {
    expect(label).toHaveStyle({ backgroundColor: "#067647" });
  }
  expect(inventoryCoverage).toHaveBeenCalledWith([{ stationId: "station-1", grade: "Regular" }], 14);
});
