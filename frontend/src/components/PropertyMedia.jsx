import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import client from "@/api/client";
import { imageUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

function PropertyMedia({ propertyId, media, onChange }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const form = new FormData();
    files.forEach((file) => form.append("images", file));

    setUploading(true);
    try {
      await client.post(`/properties/${propertyId}/media`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(t("propertyForm.uploaded"));
      onChange();
    } catch (err) {
      toast.error(err.response?.data?.message || t("propertyForm.saveError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const setCover = async (mediaId) => {
    try {
      await client.patch(`/properties/${propertyId}/media/${mediaId}/cover`);
      toast.success(t("propertyForm.coverUpdated"));
      onChange();
    } catch (err) {
      toast.error(err.response?.data?.message || t("propertyForm.saveError"));
    }
  };

  const remove = async (mediaId) => {
    try {
      await client.delete(`/properties/${propertyId}/media/${mediaId}`);
      toast.success(t("propertyForm.imageDeleted"));
      onChange();
    } catch (err) {
      toast.error(err.response?.data?.message || t("propertyForm.saveError"));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">
            {t("propertyForm.imagesTitle")}
          </CardTitle>
          <CardDescription>{t("propertyForm.imagesHint")}</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {uploading ? t("propertyForm.uploading") : t("propertyForm.upload")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </CardHeader>
      <CardContent>
        {media.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-8" />
            {t("propertyForm.imagesHint")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border",
                  m.is_cover && "ring-2 ring-primary"
                )}
              >
                <img
                  src={imageUrl(m.file_url)}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
                {m.is_cover && (
                  <span className="absolute start-2 top-2 rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {t("propertyForm.cover")}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2">
                  {!m.is_cover && (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="size-8"
                      title={t("propertyForm.setCover")}
                      onClick={() => setCover(m.id)}
                    >
                      <Star />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-8 text-destructive hover:text-destructive"
                    title={t("propertyForm.deleteImage")}
                    onClick={() => remove(m.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PropertyMedia;