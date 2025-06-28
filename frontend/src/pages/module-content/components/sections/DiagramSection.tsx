import React, { forwardRef } from 'react';
import DiagramEditor, { DiagramEditorHandle } from '../../../../components/business/SectionModules/DiagramEditor';
import { ApiInterfaceCard, DatabaseTable } from '../../../../types/modules';

interface DiagramSectionProps {
  moduleNodeId: number;
  isEditable?: boolean;
  diagramType?: 'business' | 'tableRelation';
  showResourcePanel?: boolean;
  apiInterfaces?: ApiInterfaceCard[];
  databaseTables?: DatabaseTable[];
}
  
const DiagramSection = forwardRef<DiagramEditorHandle, DiagramSectionProps>(({ 
  moduleNodeId, 
  isEditable = true,
  diagramType = 'business',
  showResourcePanel = false,
  apiInterfaces = [],
  databaseTables = []
}, ref) => {
  return (
    <div className="section-content">
      <DiagramEditor
        ref={ref}
        moduleId={moduleNodeId}
        isEditable={isEditable}
        diagramType={diagramType}
        showResourcePanel={showResourcePanel}
        apiInterfaces={apiInterfaces}
        databaseTables={databaseTables}
      />
    </div>
  );
});

export default DiagramSection; 