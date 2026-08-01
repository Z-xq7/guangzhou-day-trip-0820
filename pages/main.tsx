import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { TripPlanner } from "../src/features/trip/TripPlanner";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Trip planner root element is missing");
}

createRoot(rootElement).render(<TripPlanner />);
