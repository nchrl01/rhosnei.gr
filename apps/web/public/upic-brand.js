// Display the supplied transparent mark without processing its pixels.
export function createUpicBrand(img,fallback){
 img.hidden=true;
 fallback.hidden=false;
 img.style.filter='none';
 img.onload=()=>{img.hidden=false;fallback.hidden=true;};
 img.onerror=()=>{img.hidden=true;fallback.hidden=false;};
 img.src='upic-logo-transparent.svg?v=115';
}
