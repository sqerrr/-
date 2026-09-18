import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg'};

function safeFile(pathname){
  let p=pathname==='/'?'/public/index.html':pathname;
  if(!p.startsWith('/dist/')&&!p.startsWith('/public/'))p='/public'+p;
  const rel=normalize(p.replace(/^\/+/,''));
  const file=join(root,rel);
  const rootPrefix=root.endsWith(sep)?root:root+sep;
  if(file!==root&&!file.startsWith(rootPrefix))throw new Error('invalid path');
  return file;
}

const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url||'/', 'http://localhost').pathname;
    const file=safeFile(pathname);
    const info=await stat(file);
    if(!info.isFile())throw new Error('not a file');
    res.writeHead(200,{
      'Content-Type':mime[extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store'
    });
    res.end(await readFile(file));
  }catch(err){
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('not found');
  }
});

const port=Number(process.env.PORT||8080);
server.listen(port,'127.0.0.1',()=>console.log(`Roguelike reference: http://localhost:${port}`));
