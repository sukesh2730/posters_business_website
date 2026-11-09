"""Browser check for src/utils/printExport.ts (needs: pip install playwright && playwright install chromium; run `npx vite --port 3100` first).
Cuts a 4-colour photo into a 4-piece split and checks each panel, plus wall, mix, ZIP, empty-slot and low-resolution cases.
Run: python3 tests/browser/print-export-check.py"""
import asyncio, json
from playwright.async_api import async_playwright

JS = r"""
async () => {
  const exp = await import('/src/utils/printExport.ts');
  const J = await import('/node_modules/.vite/deps/jszip.js').catch(()=>null);
  const out = {};
  const mkBlob = (w,h,draw) => new Promise(r => { const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); c.toBlob(r,'image/png'); });
  const quad = () => mkBlob(800,1131,(x,w,h)=>{ x.fillStyle='#ff0000'; x.fillRect(0,0,w/2,h/2); x.fillStyle='#00ff00'; x.fillRect(w/2,0,w/2,h/2); x.fillStyle='#0000ff'; x.fillRect(0,h/2,w/2,h/2); x.fillStyle='#ffff00'; x.fillRect(w/2,h/2,w/2,h/2); });
  const fetcher = async () => quad();
  const px = async (blob) => { const b = await createImageBitmap(blob); const c=document.createElement('canvas'); c.width=b.width; c.height=b.height; const x=c.getContext('2d'); x.drawImage(b,0,0); const d=x.getImageData(Math.floor(b.width/2),Math.floor(b.height/2),1,1).data; return {w:b.width,h:b.height,rgb:[d[0],d[1],d[2]]}; };
  const spread = async (blob) => { const b = await createImageBitmap(blob); const c=document.createElement('canvas'); c.width=64; c.height=64; const x=c.getContext('2d'); x.drawImage(b,0,0,64,64); const d=x.getImageData(0,0,64,64).data; let mn=255,mx=0; for(let i=0;i<d.length;i+=4){ const v=d[i]+d[i+1]+d[i+2]; mn=Math.min(mn,v/3); mx=Math.max(mx,v/3);} return mx-mn; };

  // C. 4-piece photo split: each panel must be one quadrant colour
  let job = await exp.buildPrintJob({kind:'split',pieces:4,size:'A4',source:{type:'photo',url:'/api/images/x?token=1',focusX:50,focusY:50}}, 'MP-T1', fetcher);
  out.split4 = await Promise.all(job.files.map(f=>px(f.blob)));
  out.split4names = job.files.map(f=>f.name);

  // D. 5-piece design: sizes
  job = await exp.buildPrintJob({kind:'split',pieces:5,size:'A4',source:{type:'design',designId:'cars-1'}}, 'MP-T2');
  out.split5 = job.files.map(f=>[f.width,f.height]);
  out.split5spread = await spread(job.files[2].blob);

  // E. 8-piece A3 (needs downscale to fit the canvas limit)
  job = await exp.buildPrintJob({kind:'split',pieces:8,size:'A3',source:{type:'design',designId:'music-2'}}, 'MP-T3');
  out.split8 = job.files.map(f=>[f.width,f.height]);
  out.split8sheet = job.sheet.split('\n').filter(l=>l.includes('dpi'))[0];

  // G. low-res photo warning
  const tiny = () => mkBlob(300,400,(x,w,h)=>{x.fillStyle='#888';x.fillRect(0,0,w,h);});
  job = await exp.buildPrintJob({kind:'split',pieces:4,size:'A3',source:{type:'photo',url:'/api/images/y?token=1'}}, 'MP-T4', async()=>tiny());
  out.lowres = job.sheet.includes('WARNING');

  // A. mix pack
  const ids = Array.from({length:10},(_,i)=>['cars-1','heroes-2','gaming-3','music-4','movies-5'][i%5]);
  job = await exp.buildPrintJob({kind:'mix',tierId:'s10',designIds:ids}, 'MP-T5');
  out.mix = {n: job.files.length, dims: [...new Set(job.files.map(f=>f.width+'x'+f.height))], spread: await spread(job.files[0].blob)};

  // B. hero wall with a photo in slot 1
  const slots = Array.from({length:20},(_,i)=> i===0 ? {type:'photo',url:'/api/images/z?token=1'} : {type:'design',designId:'divine-'+((i%8)+1)});
  job = await exp.buildPrintJob({kind:'wall',layoutId:'hero',slots}, 'MP-T6', fetcher);
  out.wall = {n: job.files.length, first: [job.files[0].width, job.files[0].height], landscape: job.files.filter(f=>f.width>f.height).map(f=>f.width+'x'+f.height), names: job.files.slice(0,3).map(f=>f.name)};

  // F. zip
  const z = await exp.buildPrintZip({kind:'mix',tierId:'s7',designIds:Array(7).fill('gym-1')}, 'MP-T7');
  const buf = new Uint8Array(await z.blob.arrayBuffer()); let bin=''; for (let i=0;i<buf.length;i+=32768) bin += String.fromCharCode(...buf.subarray(i,i+32768));
  out.zip = {name: z.fileName, count: z.fileCount, bytes: z.blob.size, b64: btoa(bin)};

  // empty slot must be refused
  try { await exp.buildPrintJob({kind:'wall',layoutId:'large',slots:Array(17).fill(null)}, 'MP-T8'); out.emptyRefused=false; } catch(e) { out.emptyRefused = String(e.message); }
  return out;
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://127.0.0.1:3100/', wait_until='domcontentloaded')
        await pg.wait_for_timeout(2000)
        res = await pg.evaluate(JS)
        import base64, io, zipfile
        z = res['zip']; zf = zipfile.ZipFile(io.BytesIO(base64.b64decode(z.pop('b64'))))
        z['entries'] = len(zf.namelist()); z['names'] = zf.namelist()[:3]
        z['sheet_ok'] = any(n.endswith('packing-sheet.txt') for n in zf.namelist()); z['zip_valid'] = zf.testzip() is None
        print(json.dumps(res, indent=1))
        print('page errors:', errs[:3])
        await b.close()
asyncio.run(main())
