"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from "@avastudio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { trpc } from "@/lib/trpc";

const TONES = ["expert", "friendly", "bold", "ironic", "inspirational"] as const;
type Tone = (typeof TONES)[number];

interface Draft {
  name: string;
  niche: string;
  tone: Tone;
  language: string;
  promptTemplate: string;
}

const EMPTY: Draft = { name: "", niche: "", tone: "friendly", language: "ru", promptTemplate: "" };

/** Уменьшает фото до 768px и отдаёт data-URI (jpeg) — чтобы не таскать мегабайты. */
async function fileToDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read error"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("img error"));
    i.src = dataUrl;
  });
  const max = 768;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Вкладка «AI-Персоны» — профили генерации (тон, ниша, язык, шаблон промпта).
 * Персона задаёт стиль для AI-Генерации и подписей. Phase-1: in-memory CRUD.
 */
export default function PersonasPage(): JSX.Element {
  const t = useTranslations("Personas");
  const utils = trpc.useUtils();
  const list = trpc.personas.list.useQuery();
  const onDone = (): void => {
    void utils.personas.list.invalidate();
    setDraft(EMPTY);
    setEditId(null);
  };
  const create = trpc.personas.create.useMutation({ onSuccess: onDone });
  const update = trpc.personas.update.useMutation({ onSuccess: onDone });
  const remove = trpc.personas.remove.useMutation({ onSuccess: () => void utils.personas.list.invalidate() });
  const setReference = trpc.personas.setReference.useMutation({ onSuccess: () => void utils.personas.list.invalidate() });

  async function uploadFace(id: string, file: File | undefined): Promise<void> {
    if (!file) return;
    const imageUrl = await fileToDataUrl(file);
    setReference.mutate({ id, imageUrl });
  }

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const valid = draft.name.trim() !== "" && draft.niche.trim() !== "" && draft.promptTemplate.trim() !== "";

  function submit(): void {
    if (editId) update.mutate({ id: editId, ...draft });
    else create.mutate(draft);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{editId ? t("editTitle") : t("newTitle")}</CardTitle>
            <CardDescription>{t("formDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="niche">{t("niche")}</Label>
              <Input id="niche" value={draft.niche} onChange={(e) => setDraft({ ...draft, niche: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("tone")}</Label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((tone) => (
                  <Button
                    key={tone}
                    type="button"
                    size="sm"
                    variant={draft.tone === tone ? "default" : "outline"}
                    onClick={() => setDraft({ ...draft, tone })}
                  >
                    {t(`toneLabel.${tone}`)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lang">{t("language")}</Label>
              <Input id="lang" value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value })} className="w-24" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl">{t("template")}</Label>
              <Input id="tpl" value={draft.promptTemplate} onChange={(e) => setDraft({ ...draft, promptTemplate: e.target.value })} placeholder={t("templatePlaceholder")} />
            </div>
            <div className="flex gap-2">
              <Button disabled={!valid || create.isPending || update.isPending} onClick={submit}>
                {editId ? t("save") : t("add")}
              </Button>
              {editId ? (
                <Button variant="outline" onClick={() => { setDraft(EMPTY); setEditId(null); }}>
                  {t("cancel")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("listTitle")}</CardTitle>
            <CardDescription>{t("listDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {list.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (list.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <ul className="space-y-3">
                {(list.data ?? []).map((p) => (
                  <li key={p.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="secondary">{t(`toneLabel.${p.tone}`)}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{p.niche} · {p.language}</div>
                    <p className="mt-1 text-sm">{p.promptTemplate}</p>
                    <div className="mt-2 flex items-center gap-3">
                      {p.referenceImageUrl ? (
                        <img src={p.referenceImageUrl} alt="лицо" className="h-12 w-12 rounded-md border object-cover" />
                      ) : null}
                      {p.referenceImageUrl ? (
                        <Badge variant="secondary">Лицо персонажа привязано</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Фото персонажа не задано</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                        {p.referenceImageUrl ? "Заменить фото" : "Загрузить фото лица"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void uploadFace(p.id, e.target.files?.[0])}
                        />
                      </label>
                      <Button size="sm" variant="outline" onClick={() => { setEditId(p.id); setDraft({ name: p.name, niche: p.niche, tone: p.tone, language: p.language, promptTemplate: p.promptTemplate }); }}>
                        {t("edit")}
                      </Button>
                      <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate({ id: p.id })}>
                        {t("delete")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
