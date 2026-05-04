import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1>Settings</h1>
        <p className="text-text-muted">Runtime configuration is read from the backend <code>.env</code>.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Models</CardTitle>
          <CardDescription>Swap LLM / OCR engines without code changes.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-text-muted space-y-1.5">
          <div>LLM: <span className="font-mono">gemma3:4b</span> via Ollama</div>
          <div>OCR: <span className="font-mono">tesseract</span></div>
          <div>Embedder: <span className="font-mono">all-MiniLM-L6-v2</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
