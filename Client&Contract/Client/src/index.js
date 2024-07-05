import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import WalletConnection from "./components/WalletConnection";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <WalletConnection />
  </React.StrictMode>
);
