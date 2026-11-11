import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bath, BedDouble, Building2, MapPin, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice, imageUrl } from "@/lib/format";

function PropertyCard({ property, index = 0 }) {
  const { t, i18n } = useTranslation();
  const p = property;
  const location = [p.locality, p.city].filter(Boolean).join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index, 5) * 0.07 }}
    >
      <Link
        to={`/properties/${p.slug}`}
        className="group block overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {p.cover_image ? (
            <img
              src={imageUrl(p.cover_image)}
              alt={p.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Building2 className="size-10 text-muted-foreground" />
            </div>
          )}
          <div className="absolute start-3 top-3 flex gap-2">
            <Badge className="bg-background/90 text-foreground backdrop-blur">
              {t(`propertyPurpose.${p.purpose}`)}
            </Badge>
            {p.status && p.status !== "available" && (
              <Badge className="gap-1.5 bg-background/90 text-foreground backdrop-blur">
                <span
                  className={
                    p.status === "sold" || p.status === "rented"
                      ? "size-1.5 rounded-full bg-destructive"
                      : "size-1.5 rounded-full bg-amber-500"
                  }
                />
                {t(`propertyStatus.${p.status}`)}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div>
            <div className="text-lg font-semibold">
              <span dir="ltr" className="inline-block">
                {formatPrice(p.price, p.currency, i18n.language)}
              </span>
            </div>
            <h3 className="mt-1 line-clamp-1 font-medium">{p.title}</h3>
            {location && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-4 shrink-0" />
                <span className="line-clamp-1">{location}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t pt-3 text-sm text-muted-foreground">
            {p.bedrooms != null && (
              <span className="flex items-center gap-1.5">
                <BedDouble className="size-4" />
                {t("public.beds", { count: p.bedrooms })}
              </span>
            )}
            {p.bathrooms != null && (
              <span className="flex items-center gap-1.5">
                <Bath className="size-4" />
                {t("public.baths", { count: p.bathrooms })}
              </span>
            )}
            {p.area_value != null && (
              <span className="flex items-center gap-1.5">
                <Ruler className="size-4" />
                {Number(p.area_value).toLocaleString(i18n.language)}{" "}
                {t(`areaUnit.${p.area_unit}`)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default PropertyCard;