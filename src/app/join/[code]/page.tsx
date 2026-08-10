import { JoinRoomScreen } from "@/components/screens/join-room-screen";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinRoomScreen code={code.toUpperCase()} />;
}