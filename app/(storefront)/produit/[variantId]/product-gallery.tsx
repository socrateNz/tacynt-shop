import { MediaGallery } from "../../../media-gallery";

export function ProductGallery({
  imageIds,
  productId,
  designation,
}: {
  imageIds: string[];
  productId: string;
  designation: string;
}) {
  return (
    <MediaGallery
      imageUrls={imageIds.map((id) => `/api/products/${productId}/images/${id}`)}
      alt={designation}
    />
  );
}
