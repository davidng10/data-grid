import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";

import "./index.css";

import { PlaygroundPageV2 } from "./pages/playground-v2/PlaygroundPage";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StrictMode>
      <Routes>
        <Route path="/" element={<PlaygroundPageV2 />} />
        {/* <Route path="/" element={<PlaygroundPage />} /> */}
      </Routes>
    </StrictMode>
  </BrowserRouter>,
);
