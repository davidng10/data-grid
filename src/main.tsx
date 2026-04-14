import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router";
import { App } from "./App";
import { DataGrid } from "./pages/DataGrid";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StrictMode>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/data-grid" element={<DataGrid />} />
      </Routes>
    </StrictMode>
  </BrowserRouter>,
);
