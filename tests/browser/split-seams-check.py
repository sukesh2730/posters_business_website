"""Browser check that adjacent split-poster panels join without a visible seam (3, 4, 5, 8 pieces at full resolution).
Needs the same setup as print-export-check.py. Writes stitched previews to /tmp/p3.png, p4.png, p8.png."""
import asyncio, json, base64
from playwright.async_api import async_playwright
JS = r"""
async () => {
  const exp = await import('/src/utils/printExport.ts');
  const out = {};
  const bmp = async (blob) => createImageBitmap(blob);
  const col = (b, side) => { const c=document.createElement('canvas'); c.width=1; c.height=128; const x=c.getContext('2d'); x.drawImage(b, side==='right'? b.width-1:0, 0, 1, b.height, 0,0,1,128); return x.getImageData(0,0,1,128).data; };
  const row = (b, side) => { const c=document.createElement('canvas'); c.width=128; c.height=1; const x=c.getContext('2d'); x.drawImage(b, 0, side==='bottom'? b.height-1:0, b.width, 1, 0,0,128,1); return x.getImageData(0,0,128,1).data; };
  const diff = (a,b) => { let s=0,n=0; for(let i=0;i<a.length;i+=4){ s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); n+=3;} return s/n; };
  const stitch = async (job, cols, rows) => { // preview only, panels scaled down
    const bs = await Promise.all(job.files.map(f=>bmp(f.blob)));
    const tw = 200, th = Math.round(200*bs[0].height/bs[0].width);
    const c=document.createElement('canvas'); c.width=tw*cols; c.height=th*rows; const x=c.getContext('2d');
    bs.forEach((b,i)=>x.drawImage(b,(i%cols)*tw,Math.floor(i/cols)*th,tw,th)); return c.toDataURL('image/png');
  };
  const seams = async (id, pieces, size) => {
    const job = await exp.buildPrintJob({kind:'split',pieces,size,source:{type:'design',designId:id}}, 'MP-S');
    const b = await Promise.all(job.files.map(f=>bmp(f.blob)));
    const r = {dims: [b[0].width,b[0].height]};
    if (pieces===3) r.h = [diff(col(b[0],'right'),col(b[1],'left')), diff(col(b[1],'right'),col(b[2],'left'))];
    if (pieces===4) { r.h = [diff(col(b[0],'right'),col(b[1],'left')), diff(col(b[2],'right'),col(b[3],'left'))]; r.v = [diff(row(b[0],'bottom'),row(b[2],'top')), diff(row(b[1],'bottom'),row(b[3],'top'))]; }
    if (pieces===8) { r.h = [0,1,2].map(i=>diff(col(b[i],'right'),col(b[i+1],'left'))); r.v = [0,1,2,3].map(i=>diff(row(b[i],'bottom'),row(b[i+4],'top'))); }
    return {r, job};
  };
  const s3 = await seams('cars-1',3,'A4'); out.s3 = s3.r; out.p3 = await stitch(s3.job,3,1);
  const s4 = await seams('music-2',4,'A4'); out.s4 = s4.r; out.p4 = await stitch(s4.job,2,2);
  const s8 = await seams('divine-2',8,'A3'); out.s8 = s8.r; out.p8 = await stitch(s8.job,4,2);
  // 5-piece: centre vs left panels seam (left column = 2 stacked, right edge of left vs left edge of centre)
  const j5 = await exp.buildPrintJob({kind:'split',pieces:5,size:'A4',source:{type:'design',designId:'kollywood-2'}}, 'MP-S');
  const b5 = await Promise.all(j5.files.map(f=>bmp(f.blob)));
  out.s5 = {dims: j5.files.map(f=>[f.width,f.height]), h:[diff(col(b5[0],'right'),col(b5[2],'left').slice(0,col(b5[0],'right').length)) ]};
  return out;
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://127.0.0.1:3100/', wait_until='domcontentloaded'); await pg.wait_for_timeout(2000)
        res = await pg.evaluate(JS)
        for k in ('p3','p4','p8'):
            open(f'/tmp/{k}.png','wb').write(base64.b64decode(res.pop(k).split(',')[1]))
        print(json.dumps(res)); print('page errors:', errs[:3]); await b.close()
asyncio.run(main())
