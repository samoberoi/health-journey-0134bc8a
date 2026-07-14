import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Folder inside the `avatars` bucket, e.g. "coaches" or "channel-partners" */
  folder: string;
  /** Stable id to key the filename (coach id / partner id / phone). Falls back to random. */
  entityId?: string | null;
  label?: string;
}

export default function AvatarUploader({ value, onChange, folder, entityId, label = "Profile photo" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const key = `${folder}/${entityId || crypto.randomUUID()}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(key, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(key);
      onChange(data.publicUrl);
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center border">
          {value ? (
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">No photo</span>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
              {value ? "Replace photo" : "Upload photo"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={uploading}>
                <X className="w-4 h-4 mr-1" /> Remove
              </Button>
            )}
          </div>
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="…or paste an image URL"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <p className="sr-only">{label}</p>
    </div>
  );
}
