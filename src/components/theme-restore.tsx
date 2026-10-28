"use client";
import { useEffect } from "react";

export default function ThemeRestore() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const restore = () => {
      const theme = localStorage.getItem("origine-theme");
      document.documentElement.dataset.theme = theme === "dark" || (theme === "system" && media.matches) ? "dark" : "light";
    };
    restore(); media.addEventListener("change", restore); window.addEventListener("storage", restore);
    return () => { media.removeEventListener("change", restore); window.removeEventListener("storage", restore); };
  }, []);
  return null;
}
