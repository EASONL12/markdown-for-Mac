import type { ImagePreviewState } from "../shared/types/ui";

interface ImagePreviewDialogProps {
  image: ImagePreviewState;
  onClose: () => void;
}

export function ImagePreviewDialog({ image, onClose }: ImagePreviewDialogProps) {
  return (
    <div className="image-preview-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="image-preview-surface" onClick={(event) => event.stopPropagation()}>
        <div className="image-preview-header">
          <span>{image.alt || "Image preview"}</span>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <img src={image.src} alt={image.alt} />
      </div>
    </div>
  );
}

