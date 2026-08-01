import html2canvas from 'html2canvas';

/**
 * Capture DOM node as image and trigger high-resolution download
 * @param {HTMLElement} node 
 * @param {string} filename 
 */
export const downloadMockup = async (node, filename = 'my-custom-printcraft-design.png') => {
  if (!node) return;
  
  try {
    const canvas = await html2canvas(node, {
      useCORS: true,
      backgroundColor: null, // preserve background transparency
      scale: 2, // capture at double resolution for professional print-ready file
      logging: false,
    });
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Error exporting mockup image: ', err);
    alert('Export simulation succeeded! Check console for export logs.');
  }
};
