import Link from "next/link";
import { StatusScreen } from "@/components/StatusScreen";

export const metadata = { title: "Not found — Prompt Diary" };

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="This page wandered off"
      message="The page you're after doesn't exist, was moved, or is private. Let's get you back to something useful."
    >
      <Link href="/" className="btn-primary">
        Go home
      </Link>
      <Link href="/gallery" className="btn">
        Browse the gallery
      </Link>
    </StatusScreen>
  );
}
