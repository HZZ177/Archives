import { ExcalidrawElement, ExcalidrawState } from "@excalidraw/excalidraw/types/types";

export interface DiagramData {
  elements: ExcalidrawElement[];
  state: ExcalidrawState;
  version?: number;
}

export interface DiagramResponse {
  diagram_data: DiagramData;
  version: number;
} 