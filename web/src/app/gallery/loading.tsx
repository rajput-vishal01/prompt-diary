import { BrandLoading } from "@/components/StatusScreen";

// Route-chunk fallback for the gallery segment. The page itself paints its
// own in-shell skeletons the moment it mounts; this only covers the brief
// JS-chunk load on a cold navigation.
export default function GalleryLoading() {
  return <BrandLoading />;
}
