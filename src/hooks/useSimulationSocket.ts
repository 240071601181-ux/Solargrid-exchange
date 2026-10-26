import { useContext } from "react";
import {
  SimulationSocketContext,
  type SimulationSocketValue,
} from "../context/SimulationSocketProvider";

export function useSimulationSocket(): SimulationSocketValue {
  const value = useContext(SimulationSocketContext);
  if (!value) {
    throw new Error("useSimulationSocket must be used inside SimulationSocketProvider");
  }
  return value;
}
