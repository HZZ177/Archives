export interface Template {
  id: number;
  name: string;
  description?: string;
  created_by: number;
  created_at: string;
}

export interface Document {
  id: number;
  template_id: number;
  title: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: number;
  document_id: number;
  section_type: SectionType;
  title?: string;
  content?: string;
  display_order: number;
  images?: Image[];
}

export interface Image {
  id: number;
  section_id: number;
  file_path: string;
  original_name?: string;
  mime_type?: string;
  file_size?: number;
  uploaded_at: string;
}

export interface Relation {
  id: number;
  source_doc_id: number;
  target_doc_id: number;
  target_doc_title?: string;
  relation_type?: string;
  description?: string;
}

export type SectionType = 'overview' | 'diagram' | 'detail' | 'database' | 'relation' | 'api';

export interface DocumentDetail extends Document {
  sections: Section[];
  relations: Relation[];
}

export interface TemplateFormData {
  name: string;
  description?: string;
}

export interface DocumentFormData {
  template_id: number;
  title: string;
}

export interface SectionFormData {
  id?: number;
  section_type: SectionType;
  title?: string;
  content?: string;
  display_order: number;
}

export interface RelationFormData {
  target_doc_id: number;
  relation_type?: string;
  description?: string;
}

export interface DocumentQueryParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  template_id?: number;
}

export interface DocumentState {
  currentDocument: DocumentDetail | null;
  templates: Template[];
  documents: Document[];
  isLoading: boolean;
}

export interface DocumentContextType {
  documentState: DocumentState;
  fetchDocuments: (params?: DocumentQueryParams) => Promise<void>;
  fetchDocument: (id: number) => Promise<void>;
  createDocument: (data: DocumentFormData) => Promise<number>;
  updateDocument: (id: number, data: DocumentFormData) => Promise<void>;
  deleteDocument: (id: number) => Promise<void>;
  fetchTemplates: () => Promise<void>;
  updateSection: (documentId: number, section: SectionFormData) => Promise<void>;
  uploadImage: (sectionId: number, file: File) => Promise<Image>;
  deleteImage: (imageId: number) => Promise<void>;
  createRelation: (documentId: number, relation: RelationFormData) => Promise<void>;
  deleteRelation: (relationId: number) => Promise<void>;
} 