import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Service Worker temporaneamente disabilitato per debug
// if ("serviceWorker" in navigator) {
//   window.addEventListener("load", () => {
//     navigator.serviceWorker.register("/sw.js")
//       .then(() => console.log("SW registrato"))
//       .catch(e => console.log("SW errore:", e));
//   });
// }

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);