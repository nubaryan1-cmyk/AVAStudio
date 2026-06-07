import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@avastudio/ui";

/** Вкладка «Видео» внутри AI-Генерации. */
export default function VideoPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Видео</CardTitle>
        <CardDescription>AI-генерация видео. Раздел в подготовке.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Здесь будет генерация видео из промпта/сценария: выбор движка, длительность,
        формат площадки и очередь рендера.
      </CardContent>
    </Card>
  );
}
