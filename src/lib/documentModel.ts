export interface MarkdownDocument {
  id: string;
  path: string | null;
  content: string;
  isDirty: boolean;
}

export interface OpenedMarkdownFile {
  path: string;
  content: string;
}

export interface MarkdownWorkspace {
  documents: MarkdownDocument[];
  activeDocumentId: string;
}

const starterMarkdown = `# Untitled

Start writing Markdown here.

- Edit on the left
- Read the preview on the right
`;

function canReplaceStarterDocument(workspace: MarkdownWorkspace): boolean {
  const [document] = workspace.documents;
  return workspace.documents.length === 1 && document.path === null && !document.isDirty;
}

export function createInitialDocument(): MarkdownDocument {
  return {
    id: "untitled",
    path: null,
    content: starterMarkdown,
    isDirty: false
  };
}

export function createInitialWorkspace(): MarkdownWorkspace {
  const document = createInitialDocument();
  return {
    documents: [document],
    activeDocumentId: document.id
  };
}

export function updateContent(document: MarkdownDocument, content: string): MarkdownDocument {
  if (document.content === content) {
    return document;
  }

  return {
    ...document,
    content,
    isDirty: true
  };
}

export function markSaved(document: MarkdownDocument, path: string): MarkdownDocument {
  return {
    ...document,
    id: path,
    path,
    isDirty: false
  };
}

export function getDisplayName(document: MarkdownDocument): string {
  const baseName = document.path ? document.path.split(/[\\/]/).pop() || "Untitled.md" : "Untitled.md";
  return document.isDirty ? `${baseName} *` : baseName;
}

export function getActiveDocument(workspace: MarkdownWorkspace): MarkdownDocument {
  return workspace.documents.find((document) => document.id === workspace.activeDocumentId) ?? workspace.documents[0];
}

export function addOrActivateDocument(workspace: MarkdownWorkspace, file: OpenedMarkdownFile): MarkdownWorkspace {
  const existing = workspace.documents.find((document) => document.path === file.path);
  if (existing) {
    return {
      ...workspace,
      activeDocumentId: existing.id
    };
  }

  const document: MarkdownDocument = {
    id: file.path,
    path: file.path,
    content: file.content,
    isDirty: false
  };

  if (canReplaceStarterDocument(workspace)) {
    return {
      documents: [document],
      activeDocumentId: document.id
    };
  }

  return {
    documents: [...workspace.documents, document],
    activeDocumentId: document.id
  };
}

export function addOrActivateDocuments(workspace: MarkdownWorkspace, files: OpenedMarkdownFile[]): MarkdownWorkspace {
  return files.reduce((nextWorkspace, file) => addOrActivateDocument(nextWorkspace, file), workspace);
}

export function selectDocument(workspace: MarkdownWorkspace, documentId: string): MarkdownWorkspace {
  if (!workspace.documents.some((document) => document.id === documentId)) {
    return workspace;
  }

  return {
    ...workspace,
    activeDocumentId: documentId
  };
}

export function updateActiveContent(workspace: MarkdownWorkspace, content: string): MarkdownWorkspace {
  const activeDocument = getActiveDocument(workspace);
  return {
    ...workspace,
    documents: workspace.documents.map((document) =>
      document.id === activeDocument.id ? updateContent(document, content) : document
    )
  };
}

export function markActiveSaved(workspace: MarkdownWorkspace, path: string): MarkdownWorkspace {
  const activeDocument = getActiveDocument(workspace);
  const savedDocument = markSaved(activeDocument, path);
  const nextDocuments = workspace.documents
    .filter((document) => document.id === activeDocument.id || document.path !== path)
    .map((document) => (document.id === activeDocument.id ? savedDocument : document));

  return {
    documents: nextDocuments,
    activeDocumentId: savedDocument.id
  };
}

export function addNewDocument(workspace: MarkdownWorkspace): MarkdownWorkspace {
  const document: MarkdownDocument = {
    id: `new-${Date.now()}`,
    path: null,
    content: starterMarkdown,
    isDirty: false
  };

  return {
    documents: [...workspace.documents, document],
    activeDocumentId: document.id
  };
}

export function removeDocument(workspace: MarkdownWorkspace, documentId: string): MarkdownWorkspace {
  const index = workspace.documents.findIndex((d) => d.id === documentId);
  if (index === -1) return workspace;

  const nextDocuments = workspace.documents.filter((d) => d.id !== documentId);
  if (nextDocuments.length === 0) {
    const fallback = createInitialDocument();
    return {
      documents: [fallback],
      activeDocumentId: fallback.id
    };
  }

  let nextActiveId = workspace.activeDocumentId;
  if (nextActiveId === documentId) {
    nextActiveId = nextDocuments[Math.min(index, nextDocuments.length - 1)].id;
  }

  return {
    documents: nextDocuments,
    activeDocumentId: nextActiveId
  };
}
