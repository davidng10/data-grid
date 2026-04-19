import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";

import "./index.css";

import { PlaygroundPage } from "./pages/playground/PlaygroundPage";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StrictMode>
      <Routes>
        <Route path="/" element={<PlaygroundPage />} />
      </Routes>
    </StrictMode>
  </BrowserRouter>,
);
