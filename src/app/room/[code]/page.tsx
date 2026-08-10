import { LobbyScreen } from "@/components/screens/lobby-screen";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <LobbyScreen key={code} code={code.toUpperCase()} />;
}
