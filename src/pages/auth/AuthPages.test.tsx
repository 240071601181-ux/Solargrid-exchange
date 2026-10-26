import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { ApiError } from "../../api/client";

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../../context/AuthProvider", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      status: "anonymous",
      login: auth.login,
      register: auth.register,
      logout: vi.fn(),
      refreshSession: vi.fn(),
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("login page", () => {
  it("validates required fields before calling the API", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("shows the backend error for rejected credentials", async () => {
    auth.login.mockRejectedValue(new ApiError(401, "Invalid email or password.", "/auth/login"));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Email address"), "seller@example.com");
    await user.type(screen.getByLabelText("Password"), "WrongPass123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(auth.login).toHaveBeenCalledWith("seller@example.com", "WrongPass123!");
  });
});

describe("registration page", () => {
  it("blocks incomplete and unacknowledged registration", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Create seller account" }));
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
    expect(screen.getByText("Acknowledge the simulation and privacy terms.")).toBeInTheDocument();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it("switches the role selection and hides solar registration for buyers", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Installed solar capacity (kW)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Buyer/ }));
    expect(screen.queryByText("Installed solar capacity (kW)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create buyer account" })).toBeInTheDocument();
  });
});
