/** Orientação padrão para registro de evidências por link externo. */
export function EvidenceGuide() {
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
      <p className="font-semibold">📎 Como registrar sua evidência</p>
      <p className="mt-1 text-muted-foreground">
        Para prints, imagens, PDFs, vídeos e outros arquivos:
      </p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
        <li>Envie o arquivo para um serviço de nuvem, como Google Drive ou OneDrive.</li>
        <li>Configure a permissão para que o instrutor consiga visualizar.</li>
        <li>Copie o link de compartilhamento.</li>
        <li>Cole o link no campo “URL da evidência”.</li>
        <li>Explique no campo “Descrição” o que a evidência demonstra.</li>
      </ol>
      <p className="mt-2 text-muted-foreground">
        Também podem ser utilizados links do GitHub, aplicações publicadas e outros recursos
        solicitados pelo instrutor.
      </p>
      <p className="mt-2 font-medium">
        ⚠️ Antes de concluir, abra o link e confira se ele está acessível.
      </p>
    </div>
  );
}
