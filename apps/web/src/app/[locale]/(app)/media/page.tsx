"use client";

import { MEDIA_TYPES, type MediaType } from "@avastudio/shared/domain";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from "@avastudio/ui";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";

import type { MediaAssetRecord } from "@/server/data/media";

import { formatBytes, formatDuration, TYPE_LABELS } from "@/lib/media";
import { trpc } from "@/lib/trpc";

const TYPE_VARIANT = {
  video: "default",
  image: "secondary",
  audio: "warning",
} as const;

export default function MediaPage(): JSX.Element {
  const t = useTranslations("Media");
  const [type, setType] = useState<MediaType | "all">("all");
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const utils = trpc.useUtils();

  const listQuery = trpc.media.list.useQuery({
    ...(type === "all" ? {} : { type }),
    ...(search.length > 0 ? { search } : {}),
    ...(activeTags.length > 0 ? { tags: activeTags } : {}),
  });
  const tagsQuery = trpc.media.allTags.useQuery();

  const invalidate = useCallback(async (): Promise<void> => {
    await utils.media.invalidate();
  }, [utils]);

  const toggleTag = (tag: string): void => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <UploadDropzone onUploaded={invalidate} />

      <div className="flex flex-col gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip label={t("filterAll")} active={type === "all"} onClick={() => setType("all")} />
          {MEDIA_TYPES.map((t) => (
            <FilterChip key={t} label={TYPE_LABELS[t]} active={type === t} onClick={() => setType(t)} />
          ))}
        </div>
        {tagsQuery.data && tagsQuery.data.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tagsQuery.data.map((tag) => (
              <FilterChip
                key={tag}
                label={`#${tag}`}
                active={activeTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              />
            ))}
          </div>
        )}
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : listQuery.data && listQuery.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listQuery.data.map((asset) => (
            <MediaCard key={asset.id} asset={asset} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}

function MediaCard(props: { asset: MediaAssetRecord }): JSX.Element {
  const t = useTranslations("Media");
  const { asset } = props;
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="truncate text-base">{asset.name}</CardTitle>
          <Badge variant={TYPE_VARIANT[asset.type]}>{TYPE_LABELS[asset.type]}</Badge>
        </div>
        <CardDescription>
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
          {formatDuration(asset.durationSec)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div
          className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs text-muted-foreground"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(placeholderSvg(asset.type))}`}
            alt=""
            loading="lazy"
            className="h-10 w-10 opacity-60"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("size")}</span>
          <span>{formatBytes(asset.sizeBytes)}</span>
        </div>
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((t) => (
              <Badge key={t} variant="outline">
                #{t}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function placeholderSvg(type: MediaType): string {
  const glyph = type === "video" ? "▶" : type === "audio" ? "♪" : "🖼";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="12" y="18" font-size="16" text-anchor="middle">${glyph}</text></svg>`;
}

function FilterChip(props: { label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <Button type="button" variant={props.active ? "default" : "outline"} size="sm" onClick={props.onClick}>
      {props.label}
    </Button>
  );
}

interface ProbedFile {
  name: string;
  type: MediaType;
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
}

function detectType(file: File): MediaType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

async function probeFile(file: File): Promise<ProbedFile | null> {
  const type = detectType(file);
  if (type === null) return null;
  const base: ProbedFile = {
    name: file.name,
    type,
    sizeBytes: file.size,
    durationSec: 0,
    width: 0,
    height: 0,
  };
  const url = URL.createObjectURL(file);
  try {
    if (type === "image") {
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("decode"));
        img.src = url;
      });
      base.width = dims.w;
      base.height = dims.h;
    } else {
      const el = document.createElement(type === "video" ? "video" : "audio");
      await new Promise<void>((resolve, reject) => {
        el.onloadedmetadata = () => resolve();
        el.onerror = () => reject(new Error("decode"));
        el.src = url;
      });
      base.durationSec = Number.isFinite(el.duration) ? Math.round(el.duration) : 0;
      if (el instanceof HTMLVideoElement) {
        base.width = el.videoWidth;
        base.height = el.videoHeight;
      }
    }
  } catch {
    // метаданные недоступны — оставляем нули, серверная валидация решит
  } finally {
    URL.revokeObjectURL(url);
  }
  return base;
}

function UploadDropzone(props: { onUploaded: () => Promise<void> }): JSX.Element {
  const t = useTranslations("Media");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = trpc.media.upload.useMutation();

  const handleFiles = useCallback(
    async (files: FileList | null): Promise<void> => {
      if (!files || files.length === 0) return;
      setError(null);
      for (const file of Array.from(files)) {
        const probed = await probeFile(file);
        if (probed === null) {
          setError(t("unsupported", { name: file.name }));
          continue;
        }
        try {
          await upload.mutateAsync({ ...probed, tags: [] });
        } catch (e) {
          setError(e instanceof Error ? e.message : t("uploadError"));
        }
      }
      await props.onUploaded();
    },
    [props, upload],
  );

  const accepted = useMemo(() => "video/*,image/*,audio/*", []);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        dragging ? "border-primary bg-accent" : "border-input"
      }`}
    >
      <p className="text-sm font-medium">{t("dropHint")}</p>
      <p className="text-xs text-muted-foreground">
        {t("ffprobeHint")}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accepted}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? t("uploading") : t("selectFiles")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
