"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ImageUp, LoaderCircle } from "lucide-react";

type Props = {
  analystId: string;
  analystName: string;
  hasPhoto: boolean;
  action: (formData: FormData) => Promise<void>;
};

async function optimizePhoto(source: File) {
  if (!source.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");

  try {
    const bitmap = await createImageBitmap(source);
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível.");

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82)
    );
    if (!blob) throw new Error("Falha ao otimizar imagem.");

    const base = source.name.replace(/\.[^.]+$/, "") || "perfil";
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return source;
  }
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function AnalystPhotoUploader({ analystId, analystName, hasPhoto, action }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ file: File; preview: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState(hasPhoto ? "Foto cadastrada" : "Sem foto cadastrada");
  const [isPending, startTransition] = useTransition();

  async function onSelect(file?: File) {
    if (!file) return;
    setPreparing(true);
    setMessage("Preparando imagem...");
    const optimized = await optimizePhoto(file);
    const preview = URL.createObjectURL(optimized);
    setSelected((current) => {
      if (current?.preview) URL.revokeObjectURL(current.preview);
      return { file: optimized, preview };
    });
    setPreparing(false);
    setMessage("Foto anexada e pronta para salvar");
  }

  function submit() {
    if (!selected || isPending) return;
    const data = new FormData();
    data.set("analyst_id", analystId);
    data.set("photo", selected.file);

    startTransition(async () => {
      try {
        setMessage("Salvando foto...");
        await action(data);
        setMessage("Foto salva com sucesso");
        setSelected((current) => {
          if (current?.preview) URL.revokeObjectURL(current.preview);
          return null;
        });
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } catch {
        setMessage("Não foi possível salvar a foto");
      }
    });
  }

  return <div className="analyst-photo-uploader">
    <div className={`analyst-photo-state ${selected ? "ready" : hasPhoto ? "saved" : ""}`}>
      <span className="analyst-photo-thumb">
        {selected
          ? <img src={selected.preview} alt={`Prévia da foto de ${analystName}`}/>
          : hasPhoto
            ? <CheckCircle2 size={18}/>
            : <ImageUp size={18}/>}
      </span>
      <span className="analyst-photo-state-copy">
        <strong>{message}</strong>
        <small>
          {selected
            ? `${selected.file.name} · ${sizeLabel(selected.file.size)}`
            : hasPhoto
              ? "Você pode substituir a imagem quando quiser."
              : "JPG, PNG ou WEBP. A imagem será otimizada automaticamente."}
        </small>
      </span>
    </div>

    <div className="analyst-photo-actions">
      <label className="analyst-file">
        {preparing ? <LoaderCircle className="spin" size={15}/> : <Camera size={15}/>}
        <span>{hasPhoto ? "Trocar foto" : "Adicionar foto"}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event)=>void onSelect(event.target.files?.[0])}
          disabled={preparing || isPending}
        />
      </label>
      <button
        className="btn btn-secondary"
        type="button"
        disabled={!selected || preparing || isPending}
        onClick={submit}
      >
        {isPending ? <><LoaderCircle className="spin" size={14}/> Salvando...</> : "Salvar foto"}
      </button>
    </div>
  </div>;
}
