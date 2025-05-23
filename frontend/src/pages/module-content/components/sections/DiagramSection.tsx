import React, { forwardRef } from 'react';
import DiagramEditor, { DiagramEditorHandle } from '../../../../components/business/SectionModules/DiagramEditor';

interface DiagramSectionProps {
  moduleNodeId: number;
  isEditable?: boolean;
  }
  
const DiagramSection = forwardRef<DiagramEditorHandle, DiagramSectionProps>(({ 
  moduleNodeId, 
  isEditable = true
}, ref) => {
  return (
    <div className="section-content">
      <DiagramEditor
        ref={ref}
        moduleId={moduleNodeId}
        isEditable={isEditable}
      />
    </div>
  );
});

export default DiagramSection; 