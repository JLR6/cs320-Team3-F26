
import React from "react";
import ReactDOM from "react-dom/client";
import LoginApp from "./login";
import "./styles.css";
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element "#root" was not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <LoginApp />
  </React.StrictMode>
);
