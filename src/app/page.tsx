import { AppShell } from "@/components/app-shell";

export default function Home() {
  return <AppShell assistantEnabled={Boolean(process.env.OPENAI_API_KEY)} />;
}
