// Base URL of the backend without the /api part, used for uploaded images
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const FILES_URL = API_URL.replace(/\/api\/?$/, "");

export function imageUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${FILES_URL}${path}`;
}

export function formatPrice(value, currency = "PKR", locale = "en") {
  const number = Number(value);
  if (Number.isNaN(number)) return "-";
  return `${currency} ${number.toLocaleString(locale)}`;
}

// Badge colors for property status values
export const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  available: "bg-success/15 text-success",
  reserved: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  sold: "bg-primary/15 text-primary",
  rented: "bg-primary/15 text-primary",
};
