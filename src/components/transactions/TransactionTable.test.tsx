import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionTable } from "./TransactionTable";
import type { Transaction } from "../../types/api";

const transaction: Transaction = {
  id: 12,
  run_id: 3,
  seller_id: "HH-01",
  seller_name: "Asha Rao",
  buyer_id: "HH-05",
  buyer_name: "Meena Stores",
  power_kw: 1.5,
  interval_seconds: 900,
  energy_kwh: 0.375,
  price_inr_kwh: 7.4,
  total_value_inr: 2.775,
  status: "executed",
  created_at: "2026-10-26T00:00:00Z",
  executed_at: "2026-10-26T00:00:05Z",
};

describe("TransactionTable", () => {
  it("renders persisted transaction values and opens a detail", async () => {
    const onSelect = vi.fn();
    render(<TransactionTable transactions={[transaction]} onSelect={onSelect} />);

    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Meena Stores")).toBeInTheDocument();
    expect(screen.getByText("0.375 kWh")).toBeInTheDocument();
    expect(screen.getByText("₹7.4")).toBeInTheDocument();
    expect(screen.getByText("₹2.78")).toBeInTheDocument();
    expect(screen.getByText("executed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(onSelect).toHaveBeenCalledWith(12);
  });

  it("renders an honest empty state when no rows match", () => {
    render(<TransactionTable transactions={[]} onSelect={() => undefined} />);
    expect(screen.getByText("No transactions match")).toBeInTheDocument();
    expect(screen.getByText(/proposed trades are not records/i)).toBeInTheDocument();
  });
});
