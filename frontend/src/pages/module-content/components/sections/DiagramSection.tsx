import React, { forwardRef } from 'react';
import DiagramEditor, { DiagramEditorHandle } from '../../../../components/business/SectionModules/DiagramEditor';

interface DiagramSectionProps {
  moduleNodeId: number;
  isEditable?: boolean;
  diagramType?: 'business' | 'tableRelation';
}
  
const DiagramSection = forwardRef<DiagramEditorHandle, DiagramSectionProps>(({ 
  moduleNodeId, 
  isEditable = true,
  diagramType = 'business'
}, ref) => {
  return (
    <div className="section-content">
      <DiagramEditor
        ref={ref}
        moduleId={moduleNodeId}
        isEditable={isEditable}
        diagramType={diagramType}
      />
    </div>
  );
});

export default DiagramSection; 