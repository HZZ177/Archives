import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

export interface DiagramData {
  elements: ExcalidrawElement[];
  state: AppState;
  version?: number;
}

export interface DiagramResponse {
  diagram_data: DiagramData;
  version: number;
} 