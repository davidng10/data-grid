import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Route, Routes } from "react-router";
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
