// Decode uploads with the browser's image pipeline, including EXIF orientation.
// The live file input must remain mounted while a native picker is open.
export async function localPhoto(file, maxEdge=1200) {
  if(!file || file.size>20*1024*1024) throw new Error('Bitte wähle ein Foto bis 20 MB.');
  if(file.type && !file.type.startsWith('image/')) throw new Error('Bitte wähle eine Bilddatei.');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();
    const ratio=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.86);
  } catch {throw new Error('Dieses Foto kann dein Browser nicht lesen. Bitte verwende JPG, PNG oder WebP.');}
  finally {URL.revokeObjectURL(url);}
}
