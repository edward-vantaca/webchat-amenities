import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import BookingLinkPage from "./booking-link/BookingLinkPage";
import { isBookingLinkPath } from "./booking-link/link";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isBookingLinkPath(window.location.pathname) ? <BookingLinkPage /> : <App />}
  </React.StrictMode>,
);
